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

    it('Should allow user to supply base ', async () => {
        const { lendingBorrowingContract, cometContractInstance, cometRewardContract, usdcTokenContract, UsdcEthImpersonatedSigner, compTokenContract} = await loadFixture(deployLendingBorrowingContract);

        console.log("\t Supply Base");

            console.log('\t\t Approve : ');

            const usdcAmount = 10000 * 10**6; // 100 USDC

            const usdcBalanceOfUser = await usdcTokenContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t User usdc balance : ', usdcBalanceOfUser.toString());

            const approveTxn = await usdcTokenContract.connect(UsdcEthImpersonatedSigner).approve(lendingBorrowingContract.address, usdcAmount.toString());
            console.log('\t\t approve txn hash : ', approveTxn.hash);

            const supplyTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).supply(usdcTokenContract.address, usdcAmount.toString());
            console.log('\t\t supply txn hash : ', supplyTxn.hash);

            const userBasicsLnb = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
            console.log('\t\t user basics in lnb : ', userBasicsLnb.toString());

            const userBasicComet = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log('\t\t LnB user basics in comet : ', userBasicComet);

            const balanceOFLnb = await lendingBorrowingContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t balance of user : ', balanceOFLnb.toString());

            const balanceOfComet = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t balance of LnB in comet : ', balanceOfComet.toString());

            console.log('\t\t skipping some time .......');
            const hourInSec = 60 * 60;
            const dayInSec = 24 * hourInSec;
            const weekInSec = 7 * dayInSec;
            const monthInSec = 4 * weekInSec;
            const yearInSec = 12 * monthInSec;
            await time.increase(yearInSec);

            const balanceOFLnb1 = await lendingBorrowingContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t balance of user : ', balanceOFLnb1.toString());

            const balanceOfComet1 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t balance of LnB in comet : ', balanceOfComet1.toString());

            const maxUint = ethers.constants.MaxUint256;

            const compBalanceBefore = await compTokenContract.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t comp balance of lnb before : ', compBalanceBefore.toString());

            // const claimtx = await lendingBorrowingContract.claimReward(cometRewardContract.address);
            // console.log('\t\t claimed reward : ', claimtx.hash);
            
            const compBalanceAfter = await compTokenContract.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t comp balance of lnb before : ', compBalanceAfter.toString());

            // const rewardCheck = await lendingBorrowingContract.RewardOwed(cometRewardContract.address);
            // console.log('\t\t reward info : ', rewardCheck.hash);


            const withdrawTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).withdraw(usdcTokenContract.address, usdcAmount.toString());
            console.log('\t\t withdraw usdc txn hash : ', withdrawTxn.hash);

            const userBasicsLnb2 = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
            console.log('\t\t user basics in lnb : ', userBasicsLnb2.toString());

            const userBasicComet2 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log('\t\t LnB user basics in comet : ', userBasicComet2);

            const balanceOFLnb2 = await lendingBorrowingContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t balance of user : ', balanceOFLnb2.toString());

            const balanceOfComet2 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t balance of LnB in comet : ', balanceOfComet2);

            const withdrawAllTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).withdraw(usdcTokenContract.address, maxUint.toString());
            console.log('\t\t withdrawing all the funds : ', withdrawAllTxn.hash);

            const userBasicsLnb3 = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
            console.log('\t\t user basics in lnb : ', userBasicsLnb3.toString());

            const userBasicComet3 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log('\t\t LnB user basics in comet : ', userBasicComet3);

            const balanceOFLnb3 = await lendingBorrowingContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t balance of user : ', balanceOFLnb3.toString());

            const balanceOfComet3 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log('\t\t balance of LnB in comet : ', balanceOfComet3.toString());

            const usdcBalanceOfUserEnd = await usdcTokenContract.balanceOf(UsdcEthImpersonatedSigner.address);
            console.log('\t\t User usdc balance : ', usdcBalanceOfUserEnd.toString());
            console.log('\t\t diffrences : ', usdcBalanceOfUserEnd - usdcBalanceOfUser);

            // const baseTracking = await cometContractInstance.baseTrackingAccrued(lendingBorrowingContract.address);
            // console.log('\t\t base tracking reward : ', baseTracking);

    })

});    