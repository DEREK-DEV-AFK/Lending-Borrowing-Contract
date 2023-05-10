const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

////- CONTRACT-ADDRESSES -////
const CUSDC_MAINNET_ADDRESS = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";


describe('Lending Borrowing Contract', () => { 

    async function deployLendingBorrowingContract() {
        const [addr1, addr2, addr3, addr4] = await ethers.getSigners();

        const LnBcontract = await ethers.getContractFactory('LnB');
        const lendingBorrowingContract = await upgrades.deployProxy(LnBcontract, [CUSDC_MAINNET_ADDRESS]);
        await lendingBorrowingContract.deployed();
        // const lendingBorrowingContract = await LnBcontract.deploy(CUSDC_MAINNET_ADDRESS);


    
        return { lendingBorrowingContract, addr1, addr2, addr3, addr4 };
    }

    it('need to change borrow-collateral-factor of collateral assets ', async () => {
        const { lendingBorrowingContract, addr1, addr2 } = await loadFixture(deployLendingBorrowingContract);

        const assetAmount = 1 * 1e7; // 0.1 WBTC

        const assetInfo = await lendingBorrowingContract.getAssetInfo(1);
        console.log("\t asset info : ", assetInfo);

        const assetPrice = await lendingBorrowingContract.getCompoundPrice(assetInfo.priceFeed);
        console.log('\t asset price : ', assetPrice);

        const assetValueInBase = async (assetAmount, assetPriceFeed, assetScale) => {
            const assetPrice = await lendingBorrowingContract.getCompoundPrice(assetInfo.priceFeed);
            return (assetAmount * assetPrice / assetScale);
        } 

        const assetValueWithBorrowCollateral = (assetBaseValue, assetBorrowFactor) => {
            return assetBaseValue * assetBorrowFactor / 1e18;
        }

        const assetValueWithLiquidationCollateral = (assetBaseValue, assetLiquidationFactor) => {
            return assetBaseValue * assetLiquidationFactor / 1e18;
        }

        const wbtcAssetValueInBase = await assetValueInBase(assetAmount, assetInfo.priceFeed, assetInfo.scale);
        console.log("\t wbtc value in base : ", wbtcAssetValueInBase);

        const wbtcBorrowCollateralValue = await assetValueWithBorrowCollateral(wbtcAssetValueInBase, assetInfo.borrowCollateralFactor);
        console.log('\t wbtc value with collateralfactor : ',wbtcBorrowCollateralValue / 1e2);

        const wbtcLiquidationValue = await assetValueWithLiquidationCollateral(wbtcAssetValueInBase, assetInfo.liquidateCollateralFactor);
        console.log('\t wbtc value with liquidation factor : ', wbtcLiquidationValue / 1e2);

    })

});
