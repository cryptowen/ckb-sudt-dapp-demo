import { CkbTxHelper, ConfigItem } from "./helper/generator";
import {
  minimalCellCapacity,
  parseAddress,
  scriptToAddress,
  TransactionSkeleton,
  TransactionSkeletonType,
} from "@ckb-lumos/helpers";
import { Cell, Script, utils } from "@ckb-lumos/base";
import { ScriptType } from "./helper/indexer";
import { logger } from "./helper/logger";

export class SudtDapp extends CkbTxHelper {
  constructor(
    ckbRpcUrl: string,
    ckbIndexerUrl: string,
    public sudtConfig: ConfigItem
  ) {
    super(ckbRpcUrl, ckbIndexerUrl);
  }

  async getBalance(address: string, args: string): Promise<bigint> {
    await this.indexer.waitForSync();
    const userLock = parseAddress(address);
    const searchKey = {
      script: userLock,
      script_type: ScriptType.lock,
      filter: {
        script: {
          code_hash: this.sudtConfig.script.codeHash,
          hash_type: this.sudtConfig.script.hashType,
          args,
        },
      },
    };
    const cells = await this.indexer.getCells(searchKey);
    let balance = 0n;
    cells.forEach((cell) => {
      const amount = utils.readBigUInt128LE(cell.data);
      balance += amount;
    });
    return balance;
  }

  async issue(
    fromLockscript: Script,
    amount: bigint,
    recipientAddress?: string
  ): Promise<TransactionSkeletonType> {
    let recipient = fromLockscript;
    if (recipientAddress !== undefined) {
      recipient = parseAddress(recipientAddress);
    }
    const fromAddress = scriptToAddress(fromLockscript);
    await this.indexer.waitForSync();
    let txSkeleton = TransactionSkeleton({ cellProvider: this.indexer });
    const sudtType = {
      code_hash: this.sudtConfig.script.codeHash,
      hash_type: this.sudtConfig.script.hashType,
      args: utils.computeScriptHash(fromLockscript),
    };
    // add header
    txSkeleton = txSkeleton.update("cellDeps", (cellDeps) => {
      return cellDeps.push({
        out_point: {
          tx_hash: this.sudtConfig.cellDep.outPoint.txHash,
          index: this.sudtConfig.cellDep.outPoint.index,
        },
        dep_type: this.sudtConfig.cellDep.depType,
      });
    });
    // add output
    const sudtOutput: Cell = {
      cell_output: {
        capacity: "0x0",
        lock: fromLockscript,
        type: sudtType,
      },
      data: utils.toBigUInt128LE(amount),
    };
    const sudtCellCapacity = minimalCellCapacity(sudtOutput);
    sudtOutput.cell_output.capacity = `0x${sudtCellCapacity.toString(16)}`;
    txSkeleton = txSkeleton.update("outputs", (outputs) => {
      return outputs.push(sudtOutput);
    });
    txSkeleton = await this.completeTx(txSkeleton, fromAddress);
    return txSkeleton;
  }

  async transfer(
    fromLockscript: Script,
    sudtArgs: string,
    amount: bigint,
    recipientAddress: string
  ): Promise<TransactionSkeletonType> {
    const recipient = parseAddress(recipientAddress);
    const fromAddress = scriptToAddress(fromLockscript);
    await this.indexer.waitForSync();
    let txSkeleton = TransactionSkeleton({ cellProvider: this.indexer });
    const sudtType = {
      code_hash: this.sudtConfig.script.codeHash,
      hash_type: this.sudtConfig.script.hashType,
      args: sudtArgs,
    };
    // add header
    txSkeleton = txSkeleton.update("cellDeps", (cellDeps) => {
      return cellDeps.push({
        out_point: {
          tx_hash: this.sudtConfig.cellDep.outPoint.txHash,
          index: this.sudtConfig.cellDep.outPoint.index,
        },
        dep_type: this.sudtConfig.cellDep.depType,
      });
    });
    // collect inputs
    const searchKey = {
      script: fromLockscript,
      script_type: ScriptType.lock,
      filter: {
        script: {
          code_hash: this.sudtConfig.script.codeHash,
          hash_type: this.sudtConfig.script.hashType,
          args: sudtArgs,
        },
      },
    };
    const inputCells = await this.collector.collectSudtByAmount(
      searchKey,
      amount
    );
    let inputSudtAmount = 0n;
    inputCells.forEach((cell) => {
      const amount = utils.readBigUInt128LE(cell.data);
      inputSudtAmount += amount;
    });
    txSkeleton = txSkeleton.update("inputs", (inputs) => {
      return inputs.concat(inputCells);
    });
    const sudtLeft = inputSudtAmount - amount;
    if (sudtLeft < 0) {
      throw Error(
        `insufficient sudt, need: ${amount}, have: ${inputSudtAmount}`
      );
    }
    // add output
    const sudtOutput: Cell = {
      cell_output: {
        capacity: "0x0",
        lock: recipient,
        type: sudtType,
      },
      data: utils.toBigUInt128LE(amount),
    };
    const sudtCellCapacity = minimalCellCapacity(sudtOutput);
    sudtOutput.cell_output.capacity = `0x${sudtCellCapacity.toString(16)}`;
    txSkeleton = txSkeleton.update("outputs", (outputs) => {
      return outputs.push(sudtOutput);
    });
    // add sudt change cell if there is sudt left
    if (sudtLeft > 0) {
      const sudtChangeOutput: Cell = {
        cell_output: {
          capacity: "0x0",
          lock: fromLockscript,
          type: sudtType,
        },
        data: utils.toBigUInt128LE(sudtLeft),
      };
      const sudtChangeCellCapacity = minimalCellCapacity(sudtChangeOutput);
      sudtChangeOutput.cell_output.capacity = `0x${sudtChangeCellCapacity.toString(
        16
      )}`;
      txSkeleton = txSkeleton.update("outputs", (outputs) => {
        return outputs.push(sudtChangeOutput);
      });
    }
    // complete tx
    txSkeleton = await this.completeTx(txSkeleton, fromAddress);
    return txSkeleton;
  }
}
