const { ethers, upgrades } = require("hardhat");

async function main() {
    const COMET_GOERLI_ADDRESS = '0x3EE77595A8459e93C2888b13aDB354017B198188';
    // const TEST = '0xF25212E676D1F7F89Cd72fFEe66158f541246445'

    const [signer] = await ethers.getSigners();
    console.log("signer : ", signer.address);
  
    const LnBcontract =  await ethers.getContractFactory("LnB");
    const lendingBorrowingContract = await upgrades.deployProxy(LnBcontract, [COMET_GOERLI_ADDRESS, 5000, 1]);
  
    await lendingBorrowingContract.deployed();
  
    console.log("Lending Borrowing Contract deployed to :", lendingBorrowingContract.address);

    // const uti = await lendingBorrowingContract.getSupplyApr();
    // console.log(uti);
  }

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });