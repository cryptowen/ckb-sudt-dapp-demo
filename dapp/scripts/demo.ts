import { logger } from "../src/helper/logger";
import { RPC } from "@ckb-lumos/rpc";
import { DepType, HashType, utils } from "@ckb-lumos/base";
import {
  generateSecp256k1Blake160Address,
  parseAddress,
} from "@ckb-lumos/helpers";
import { key } from "@ckb-lumos/hd";
import { initializeConfig } from "@ckb-lumos/config-manager";
import { SudtDapp } from "../src/sudt";
import { initLog } from "../dist/helper/logger";
import { genRandomHex } from "../src/helper/utils";

async function main() {
  // uncomment below line to see detailed log
  initLog({ level: "debug" });
  logger.info("start demo");
  // init lumos config
  process.env.LUMOS_CONFIG_NAME = "AGGRON4";
  initializeConfig();
  const ckbRpcUrl = "https://testnet.ckbapp.dev";
  const ckbIndexerUrl = "https://testnet.ckbapp.dev/indexer";
  const ckb = new RPC(ckbRpcUrl);
  // set private key
  const privateKey =
    "0x08f7ee739f268c2e62963ee43d9aa680e4a56e4e7e0d1ce4882e25093ebff8fd";
  const pubkeyHash = key.privateKeyToBlake160(privateKey);
  const address = generateSecp256k1Blake160Address(pubkeyHash);
  const userLock = parseAddress(address);
  logger.info(`address: ${address}`);
  const sudtArg = utils.computeScriptHash(userLock);
  logger.info(`sudtArg: ${sudtArg}`);
  // get balance
  const sudtConfig = {
    cellDep: {
      depType: "code" as DepType,
      outPoint: {
        txHash:
          "0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769",
        index: "0x0",
      },
    },
    script: {
      codeHash:
        "0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4",
      hashType: "type" as HashType,
    },
  };
  const sudtDapp = new SudtDapp(ckbRpcUrl, ckbIndexerUrl, sudtConfig);
  const balance0 = await sudtDapp.getBalance(address, sudtArg);
  logger.info("owner initial balance:", balance0);
  // issue
  const issueUnsignedTx = await sudtDapp.issue(userLock, 100n);
  const issueTxHash = await sudtDapp.signAndSendTransaction(
    issueUnsignedTx,
    privateKey
  );
  const balance1 = await sudtDapp.getBalance(address, sudtArg);
  logger.info(`issue tx hash ${issueTxHash}`);
  logger.info("owner balance after issue:", balance1);
  // transfer
  const randomRecipientPrivatekey = genRandomHex(64);
  const recipientAddress = generateSecp256k1Blake160Address(
    key.privateKeyToBlake160(randomRecipientPrivatekey)
  );
  logger.info(
    "sender balance before transfer:",
    await sudtDapp.getBalance(address, sudtArg)
  );
  logger.info(
    "recipient balance before transfer:",
    await sudtDapp.getBalance(recipientAddress, sudtArg)
  );
  const transferUnsignedTx = await sudtDapp.transfer(
    userLock,
    10n,
    recipientAddress
  );
  const transferTxHash = await sudtDapp.signAndSendTransaction(
    transferUnsignedTx,
    privateKey
  );
  logger.info(`transfer tx hash ${transferTxHash}`);
  logger.info(
    "sender balance after transfer:",
    await sudtDapp.getBalance(address, sudtArg)
  );
  logger.info(
    "recipient balance after transfer:",
    await sudtDapp.getBalance(recipientAddress, sudtArg)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(`run demo failed, error: ${error.stack}`);
    process.exit(1);
  });
