const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

////- ABIS -////
const erc20Abi =  require('../abi/erc20Abi.json');
const cometAbi = require('../abi/cometAbi.json');
const wethAbi = require('../abi/wethAbi.json');
const cometRewardAbi =  require('../abi/cometRewardAbi.json');

////- IMPERSONATE ADDRESSES -////
const USDC_IMPERSONATE_ADDRESS = '0x500A746c9a44f68Fe6AA86a92e7B3AF4F322Ae66';
const WBTC_IMPERSONATE_ADDRESS = '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe';

////- CONTRACT-ADDRESSES -////
const CUSDC_MAINNET_ADDRESS = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";
const USDC_MAINNET_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WBTC_MAINNET_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const WETH_MAINNET_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const COMP_MAINNET_ADDRESS = '0xc00e94Cb662C3520282E6f5717214004A7f26888';

const COMET_REWARD_MAINNET_ADDRESS = '0x1B0e765F6224C21223AeA2af16c1C46E38885a40';

describe('Lending Borrowing Contract', () => { 

    async function deployLendingBorrowingContract() {
        const [addr1, addr2, addr3, addr4] = await ethers.getSigners();
        
        const UsdcEthImpersonatedSigner = await ethers.getImpersonatedSigner(USDC_IMPERSONATE_ADDRESS);
        const wbtcImpersonatedSigner = await ethers.getImpersonatedSigner(WBTC_IMPERSONATE_ADDRESS);
        // const wethImpersonatedSigner = await ethers.getImpersonatedSigner(WETH_IMPERSONATE_ADDRESS);

        await addr1.sendTransaction({
            to: wbtcImpersonatedSigner.address,
            value: ethers.utils.parseEther("100.0"), // Sends exactly 100.0 matic
        });
    
        const usdcTokenContract = await ethers.getContractAt(erc20Abi,USDC_MAINNET_ADDRESS);
        const wbtcTokenCOntract = await ethers.getContractAt(erc20Abi,WBTC_MAINNET_ADDRESS);
        const wethTokenContract = await ethers.getContractAt(wethAbi,WETH_MAINNET_ADDRESS);

        const cometRewardContract = await ethers.getContractAt(cometRewardAbi,COMET_REWARD_MAINNET_ADDRESS);
        const compTokenContract = await ethers.getContractAt(erc20Abi,COMP_MAINNET_ADDRESS);

        const cometContractInstance = await ethers.getContractAt(cometAbi,CUSDC_MAINNET_ADDRESS);
    
        const LnBcontract = await ethers.getContractFactory('LnB');
        const lendingBorrowingContract = await upgrades.deployProxy(LnBcontract, [CUSDC_MAINNET_ADDRESS]);
        await lendingBorrowingContract.deployed();
        // const lendingBorrowingContract = await LnBcontract.deploy(CUSDC_MAINNET_ADDRESS);


    
        return { lendingBorrowingContract, UsdcEthImpersonatedSigner, wbtcImpersonatedSigner, usdcTokenContract, wbtcTokenCOntract, wethTokenContract, cometContractInstance, cometRewardContract, compTokenContract, addr1, addr2, addr3, addr4 };
    }

    describe('testing is account liquidable ', () => {
        it('check weather the account is liquidatable', async () => {
            const {wbtcTokenCOntract, wbtcImpersonatedSigner, lendingBorrowingContract, usdcTokenContract, cometContractInstance} = await loadFixture(deployLendingBorrowingContract);
           
            const wbtcAmount = 10 * 10**8;

            console.log('\t Asset Info : ');
            const wbtcAssetInfo = await lendingBorrowingContract.getAssetInfo(1);
            console.log('\t wbtc address : ', wbtcAssetInfo.asset);
            console.log('\t wbtc borrowCollateralFactor : ', wbtcAssetInfo.borrowCollateralFactor);
            console.log('\t wbtc liquidationCollateralFactor : ', wbtcAssetInfo.liquidateCollateralFactor);

            console.log('\t LnB');
            // supplying 
            const approveTxn = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wbtcAmount.toString());
            console.log("\t approve txn hash : ", approveTxn.hash);

            const supplyTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, (1*1e7).toString());
            console.log("\t supply txn hash : ", supplyTxn.hash);

            const borrawableAmount0 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount0.toString());

            const borrowBalanceOf0 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t user borrow balance : ', borrowBalanceOf0.toString());

            
            const borrowTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, (borrawableAmount0).toString());
            console.log("\t user borrow txn hash : ",borrowTxn.hash);
            
            const borrawableAmount1 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount1.toString());
            
            const borrowBalanceOf1 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t user borrow balance : ', borrowBalanceOf1.toString());
            
            const userBasicsInLnB0 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log("\t user basics in LnB :", userBasicsInLnB0.toString());
            
            console.log('\t Comet');
            const userBasicComet = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log('\t user basics in comet : ', userBasicComet.principal.toString());

            const userBorrowBalanceComet = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log('\t user borrow balance in comet : ', userBorrowBalanceComet.toString());

            console.log('\t LnB');

            // checking liquidatbale 
            const isAccountLiquidatable0 = await lendingBorrowingContract.isLiquidatable(wbtcImpersonatedSigner.address);
            console.log('\t is account liquidatable : ', isAccountLiquidatable0);

            console.log('\t skipping some time........');
            const hourInSec = 60 * 60;
            const dayInSec = 24 * hourInSec;
            const weekInSec = 7 * dayInSec;
            const monthInSec = 4 * weekInSec;
            const yearInSec = 12 * monthInSec;
            const year3InSec = 3 * yearInSec;
            time.increase(year3InSec);

            const userBasicsInLnB1 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log("\t user basics in LnB :", userBasicsInLnB1.toString());

            // checking liquidatbale 
            const isAccountLiquidatable1 = await lendingBorrowingContract.isLiquidatable(wbtcImpersonatedSigner.address);
            console.log('\t is account liquidatable : ', isAccountLiquidatable1);

            const borrowBalanceOf2 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t user borrow balance : ', borrowBalanceOf2.toString());

            console.log('\t Comet');
            const userBasicComet1 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log('\t user basics in comet : ', userBasicComet1.principal.toString());

            const userBorrowBalanceComet1 = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log('\t user borrow balance in comet : ', userBorrowBalanceComet1.toString());

            const isLiquidatedComet =await cometContractInstance.isLiquidatable(lendingBorrowingContract.address);
            console.log('\t LnB is liquitable in comet : ', isLiquidatedComet);
        })
    })

});