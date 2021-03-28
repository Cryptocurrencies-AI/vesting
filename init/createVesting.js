const anchor = require("@project-serum/anchor");
const serumCmn = require("@project-serum/common");
const { PublicKey } = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
const { schedule } = require('./schedule');

createVestingFromSchedule = async (provider, vesting, schedule) => {
  const startTs = new anchor.BN(schedule.startTs / 1000 + 2000);
  const endTs = new anchor.BN(schedule.endTs + 600);
  const periodCount = new anchor.BN(schedule.periodCount);
  const beneficiary = schedule.beneficiary;

  console.log(provider.wallet.publicKey)
  const depositAmount = new anchor.BN(10);

  const vault = new anchor.web3.Account();

  let [
    _vestingSigner,
    nonce,
  ] = await anchor.web3.PublicKey.findProgramAddress(
      [vesting.publicKey.toBuffer()],
      lockup.programId
  );
  vestingSigner = _vestingSigner;
  console.log({
    vesting: vesting.publicKey.toBase58(),
    vault: vault.publicKey.toBase58(),
    depositor: depositor.publicKey,
    depositorAuthority: provider.wallet.publicKey.toBase58(),
    mint: mint
  })

  await lockup.rpc.createVesting(
      new anchor.web3.PublicKey(beneficiary),
      depositAmount,
      nonce,
      startTs,
      endTs,
      periodCount,
      null, // Lock realizor is None.
      {
        accounts: {
          vesting: vesting.publicKey,
          vault: vault.publicKey,
          depositor: tokenAddress,
          depositorAuthority: provider.wallet.publicKey,
          tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        },
        signers: [vesting, vault],
        instructions: [
          await lockup.account.vesting.createInstruction(vesting),
          ...(await serumCmn.createTokenAccountInstrs(
              provider,
              vault.publicKey,
              mint,
              vestingSigner
          )),
        ],
      }
  );

  vestingAccount = await lockup.account.vesting(vesting.publicKey);
  console.log(vestingAccount)

}

const createVesting = async () => {
  // Read the provider from the configured environmnet.
  const provider = anchor.Provider.env();

  // Configure the client to use the provider.
  anchor.setProvider(provider);
  // #region main
  // Read the generated IDL.
  const lockup_idl = JSON.parse(require('fs').readFileSync('./target/idl/lockup.json', 'utf8'));

  // Address of the deployed program.
  const lockupId = new anchor.web3.PublicKey(process.env.VESTING_PROGRAM_ADDRESS);

  // #endregion main
  const lockup = new anchor.Program(lockup_idl, lockupId);
  const depositor = new anchor.web3.Account(JSON.parse(process.env.DEPOSITOR_PRIVATE_KEY));

  let lockupAddress = null;
  const WHITELIST_SIZE = 10;

  let mint = new anchor.web3.PublicKey(process.env.MINT_ADDRESS);
  const tokenAddress = new anchor.web3.PublicKey(process.env.TOKEN_ADDRESS);

  console.log('tokenAddress == ', tokenAddress.toBase58())

  const vesting = new anchor.web3.Account();
  console.log(vesting.publicKey.toBase58())
  let vestingAccount = null;
  let vestingSigner = null;

  await Promise.all(schedule.strategic.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.ps1.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.ps2.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.team.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.marketing.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.community.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
  await Promise.all(schedule.ops.map((sch) => createVestingFromSchedule(provider, vesting , sch)))
};

createVesting();