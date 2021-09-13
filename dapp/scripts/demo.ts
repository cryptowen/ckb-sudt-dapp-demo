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
import * as dotenv from "dotenv";
import { getFromEnv } from "../src/helper/utils";
dotenv.config({ path: ".env" });

async function main() {
  // you can set log level to debug to see detailed log
  initLog({ level: "info" });
  logger.info("start demo");
  // init lumos config
  initializeConfig();
  const ckbRpcUrl = getFromEnv("CKB_RPC_URL");
  const ckbIndexerUrl = getFromEnv("CKB_INDEXER_URL");
  // const ckb = new RPC(ckbRpcUrl);
  // set private key
  const privateKey = getFromEnv("ISSUER_PRIVATE_KEY");
  const pubkeyHash = key.privateKeyToBlake160(privateKey);
  const address = generateSecp256k1Blake160Address(pubkeyHash);
  const userLock = parseAddress(address);
  logger.info(`issuer address: ${address}`);
  const sudtArg = utils.computeScriptHash(userLock);
  logger.info(`sudtArg: ${sudtArg}`);
  const alicePrivateKey = getFromEnv("ALICE_PRIVATE_KEY");
  const aliceAddress = generateSecp256k1Blake160Address(
    key.privateKeyToBlake160(alicePrivateKey)
  );
  const aliceLock = parseAddress(aliceAddress);
  logger.info(`alice address: ${aliceAddress}`);
  const bobPrivateKey = getFromEnv("BOB_PRIVATE_KEY");
  const bobAddress = generateSecp256k1Blake160Address(
    key.privateKeyToBlake160(bobPrivateKey)
  );
  logger.info(`bob address: ${bobAddress}`);
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
  // issue
  logger.info(
    "alice balance before issue:",
    await sudtDapp.getBalance(aliceAddress, sudtArg)
  );
  const issueUnsignedTx = await sudtDapp.issue(userLock, 100n, aliceAddress);
  const issueTxHash = await sudtDapp.signAndSendTransaction(
    issueUnsignedTx,
    privateKey
  );
  logger.info(`issue tx hash ${issueTxHash}`);
  logger.info(
    "alice balance after issue:",
    await sudtDapp.getBalance(aliceAddress, sudtArg)
  );
  // transfer
  logger.info(
    "alice balance before transfer:",
    await sudtDapp.getBalance(aliceAddress, sudtArg)
  );
  logger.info(
    "bob balance before transfer:",
    await sudtDapp.getBalance(bobAddress, sudtArg)
  );
  const transferUnsignedTx = await sudtDapp.transfer(
    aliceLock,
    sudtArg,
    11n,
    bobAddress
  );
  const transferTxHash = await sudtDapp.signAndSendTransaction(
    transferUnsignedTx,
    alicePrivateKey
  );
  logger.info(`transfer tx hash ${transferTxHash}`);
  logger.info(
    "alice balance before transfer:",
    await sudtDapp.getBalance(aliceAddress, sudtArg)
  );
  logger.info(
    "bob balance before transfer:",
    await sudtDapp.getBalance(bobAddress, sudtArg)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error(`run demo failed, error: ${error.stack}`);
    process.exit(1);
  });
