const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_CONTRACT_ADDRESS = '0xCf8c523eED3a1c1ebDA2415B460e3B52D85e6b44'; 
    const LnBcontract = await ethers.getContractFactory("LnB");
    const marketplaceContractV2 = await upgrades.upgradeProxy(PROXY_CONTRACT_ADDRESS, LnBcontract);
    console.log("Marketplace upgraded", marketplaceContractV2.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});