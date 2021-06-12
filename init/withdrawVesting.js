const anchor = require("@project-serum/anchor");
const serumCmn = require("@project-serum/common");
const { PublicKey } = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;
const { schedule } = require('./schedule');
require('dotenv').config()

const withdrawVested = async () => {
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
  console.log('load program')
 
  let vestingProgramAddress = null;

  let mint = new anchor.web3.PublicKey(process.env.MINT_ADDRESS);

  const vesting = new anchor.web3.PublicKey(process.env.VESTING_ACCOUNT_PUBKEY);
  let vestingAccount = await vestingProgram.account.vesting(vesting);
  console.log("vesting account address " + vesting);

  let vestingSigner = null;
  let [
    _vestingSigner,
    nonce,
  ] = await anchor.web3.PublicKey.findProgramAddress(
    [vesting.toBuffer()],
    vestingProgram.programId
  );
  vestingSigner = _vestingSigner;  
  console.log("Getting maximum withdrawal amount");
  const availableWithdrawalTxSignature = await vestingProgram.rpc.availableForWithdrawal({
    accounts: {
        vesting: vesting,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    }
  });
  console.log("Waiting for block confirmation");
    await provider.connection.confirmTransaction(availableWithdrawalTxSignature, 'max');
    let parsedTx = await provider.connection.getParsedConfirmedTransaction(availableWithdrawalTxSignature);
    
    let msg = parsedTx.meta.logMessages[1];
    const availableFunds = JSON.parse(msg.substr(msg.indexOf("{"))).result;
    console.log("Available for withdraw " + availableFunds);
    const withdrawTokenAddress = vestingAccount.beneficiary;
    
    console.log("Witdrawing available funds to the account " + withdrawTokenAddress.toBase58());
    await vestingProgram.rpc.withdraw(
        new anchor.BN(availableFunds), 
        {
          accounts: {
            vesting: vesting,
            beneficiary: withdrawTokenAddress,
            vault: vestingAccount.vault,
            vestingSigner,
            tokenProgram: TokenInstructions.TOKEN_PROGRAM_ID,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          },
        }
    );
    
    console.log('\nGetting account data of the vesting created\nVesting address ' + vesting.toBase58());
    vestingAccount = await vestingProgram.account.vesting(vesting);
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


  };

withdrawVested();