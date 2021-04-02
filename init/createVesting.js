const anchor = require("@project-serum/anchor");
const serumCmn = require("@project-serum/common");
const { PublicKey } = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
const { schedule } = require('./schedule');
require('dotenv').config()

const createVesting = async () => {
  // Read the provider from the configured environmnet.
  const provider = anchor.Provider.env();

  // Configure the client to use the provider.
  anchor.setProvider(provider);
  // #region main
  // Read the generated IDL.
  const vestingProgram_idl = JSON.parse(require('fs').readFileSync('./target/idl/lockup.json', 'utf8'));

  // Address of the deployed program.
  const vestingProgramId = new anchor.web3.PublicKey(process.env.VESTING_PROGRAM_ADDRESS);

  // #endregion main
  const vestingProgram = new anchor.Program(vestingProgram_idl, vestingProgramId);
  console.log('Vesting program loaded')
  const depositor = new anchor.web3.Account(JSON.parse(process.env.DEPOSITOR_PRIVATE_KEY));

  let vestingProgramAddress = null;
  const WHITELIST_SIZE = 10;

  let mint = new anchor.web3.PublicKey(process.env.MINT_ADDRESS);
  const tokenAddress = new anchor.web3.PublicKey(process.env.TOKEN_ADDRESS);

  console.log('Using token with address', tokenAddress.toBase58())

  let vestingAccount = null;
  let vestingSigner = null;

  const createVestingFromSchedule = async (provider, schedule) => {
    const startTs = new anchor.BN(schedule.startTs / 1000 + 2000);
    const endTs = new anchor.BN(schedule.endTs + 600);
    const periodCount = new anchor.BN(schedule.periodCount);
    const beneficiary = schedule.beneficiary;
    const depositAmount = new anchor.BN(schedule.depositAmount);
    console.log("\nCreating next vesting from the schedule");
    console.log(schedule)

    const vesting = new anchor.web3.Account();
    console.log("Generated new account for the vesting data with address " + vesting.publicKey.toBase58());

    const vault = new anchor.web3.Account();

    let [
      _vestingSigner,
      nonce,
    ] = await anchor.web3.PublicKey.findProgramAddress(
        [vesting.publicKey.toBuffer()],
        vestingProgram.programId
    );
    vestingSigner = _vestingSigner;
    console.log("\nPubkeys used for vesting");
    console.log({
      vesting: vesting.publicKey.toBase58(),
      vault: vault.publicKey.toBase58(),
      depositor: depositor.publicKey.toBase58(),
      depositorAuthority: provider.wallet.publicKey.toBase58(),
      mint: mint.toBase58()
    })

    console.log("\nCreating vesting for beneficiary " + beneficiary)
    await vestingProgram.rpc.createVesting(
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
            await vestingProgram.account.vesting.createInstruction(vesting),
            ...(await serumCmn.createTokenAccountInstrs(
                provider,
                vault.publicKey,
                mint,
                vestingSigner
            )),
          ],
        }
    );

    console.log('\nGetting account data of the vesting created\nVesting address ' + vesting.publicKey.toBase58());
    vestingAccount = await vestingProgram.account.vesting(vesting.publicKey);
    console.log({
      beneficiary: vestingAccount.beneficiary.toBase58(),
      mint: vestingAccount.mint.toBase58(),
      vault: vestingAccount.vault.toBase58(),
      grantor: vestingAccount.grantor.toBase58(),
      outstanding: vestingAccount.outstanding.toString(),
      startBalance: vestingAccount.startBalance.toString(),
      createdTs: vestingAccount.createdTs.toString(),
      startTs:vestingAccount.startTs.toString(),
      endTs:vestingAccount.endTs.toString(),
      periodCount:vestingAccount.periodCount.toString(),
      whitelistOwned: vestingAccount.whitelistOwned.toString(),
      nonce: vestingAccount.nonce,
      realizor: vestingAccount.realizor
    });

  }
  await Promise.all(schedule.strategic.map((sch) => createVestingFromSchedule(provider, sch)))
  await Promise.all(schedule.ps1.map((sch) => createVestingFromSchedule(provider, sch)))
  // await Promise.all(schedule.ps2.map((sch) => createVestingFromSchedule(provider, sch)))
  // await Promise.all(schedule.team.map((sch) => createVestingFromSchedule(provider, sch)))
  // await Promise.all(schedule.marketing.map((sch) => createVestingFromSchedule(provider, sch)))
  // await Promise.all(schedule.community.map((sch) => createVestingFromSchedule(provider, sch)))
  // await Promise.all(schedule.ops.map((sch) => createVestingFromSchedule(provider, sch)))
};

createVesting();
