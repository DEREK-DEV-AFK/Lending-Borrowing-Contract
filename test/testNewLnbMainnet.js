const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

////- ABIS -////
const erc20Abi =  require('../abi/erc20Abi.json');
const cometAbi = require('../abi/cometAbi.json');
const wethAbi = require('../abi/wethAbi.json');

////- IMPERSONATE ADDRESSES -////
const USDC_IMPERSONATE_ADDRESS = '0x500A746c9a44f68Fe6AA86a92e7B3AF4F322Ae66';
const WBTC_IMPERSONATE_ADDRESS = '0x0D0707963952f2fBA59dD06f2b425ace40b492Fe';

////- CONTRACT-ADDRESSES -////
const CUSDC_MAINNET_ADDRESS = "0xc3d688B66703497DAA19211EEdff47f25384cdc3";
const USDC_MAINNET_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WBTC_MAINNET_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const WETH_MAINNET_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const CHAINLINK_MAINNET_TOKEN_ADDRESS = '0x514910771AF9Ca656af840dff83E8264EcF986CA';

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

        const cometContractInstance = await ethers.getContractAt(cometAbi,CUSDC_MAINNET_ADDRESS);
    
        const LnBcontract = await ethers.getContractFactory('LnB');
        const lendingBorrowingContract = await upgrades.deployProxy(LnBcontract, [CUSDC_MAINNET_ADDRESS]);
        await lendingBorrowingContract.deployed();
        // const lendingBorrowingContract = await LnBcontract.deploy(CUSDC_MAINNET_ADDRESS);


    
        return { lendingBorrowingContract, UsdcEthImpersonatedSigner, wbtcImpersonatedSigner, usdcTokenContract, wbtcTokenCOntract, wethTokenContract, cometContractInstance, addr1, addr2, addr3, addr4 };
    }

    describe("test space ", () => {
        it("should test ", async () => {
            const {lendingBorrowingContract, cometContractInstance, wbtcImpersonatedSigner, wbtcTokenCOntract, usdcTokenContract, wethTokenContract} = await loadFixture(deployLendingBorrowingContract);

            const wbtcAmount = 10 * 10**8;
            const wmaticAmount = 10 * 10**18;

            const approveTxn = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wbtcAmount.toString());
            console.log("\t approve txn hash : ", approveTxn.hash);

            const supplyTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, (1*1e7).toString());
            console.log("\t supply txn hash : ", supplyTxn.hash);

            const userBasicsInLnB0 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log("\t user basics in LnB :", userBasicsInLnB0);

            const userBasicsInComet0 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log("\t contracts basics in comet : ", userBasicsInComet0.principal);


            const userBorrowBalance = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log("\t borrow balance of user : ", userBorrowBalance.toString());

            const userBalance = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t balance of user : ", userBalance.toString());

            const cometBorrowBalance = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log("\t comet borrow balance : ",cometBorrowBalance.toString());

            const cometBalance = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log("\t comet balance : ", cometBalance.toString());

          

            const borrawableAmount = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount.toString());

            const wethAmount = 5 * 10**18;

            const depositWethTxn = await wethTokenContract.connect(wbtcImpersonatedSigner).deposit({value: wethAmount.toString()});
            console.log("\t deposit weth txn hash : ", depositWethTxn.hash);

            const balanceOfWeth = await wethTokenContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t Balance of weth : ", balanceOfWeth.toString());

            const approveWethTxn = await wethTokenContract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wethAmount.toString());
            console.log("\t approve weth txn hash : ", approveWethTxn.hash);

            const supplyWethTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wethTokenContract.address, wethAmount.toString());
            console.log("\t supply wmatic txn hash : ", supplyWethTxn.hash);

            const userBorrowBalance0 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log("\t borrow balance of user : ", userBorrowBalance0.toString());

            const userBalance0 = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t balance of user : ", userBalance0.toString());

            const cometBorrowBalance0 = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log("\t comet borrow balance : ",cometBorrowBalance0.toString());

            const cometBalance0 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log("\t comet balance : ", cometBalance0.toString());

            const borrawableAmount0 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount0.toString());

            // const max_uint = await lendingBorrowingContract.MAX_UINT();
            // console.log("max uint : ", max_uint.toString());
            const max_uint = ethers.constants.MaxUint256;

            const borrowTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, (borrawableAmount0).toString());
            console.log("\t user borrow txn hash : ",borrowTxn.hash);

            const canWithdraw5wETH = await lendingBorrowingContract.canWithdrawExtraCollateral(wbtcImpersonatedSigner.address, wethTokenContract.address, (wethAmount).toString());
            console.log("\t can withdraw 1 weth from contract : ", canWithdraw5wETH);

            // const withdrawCollateralTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(wethTokenContract.address, (wethAmount).toString());
            // console.log("withdraw collateral tokens : ", withdrawCollateralTxn.hash);

            const canWithdrawBtc = await lendingBorrowingContract.canWithdrawExtraCollateral(wbtcImpersonatedSigner.address, wbtcTokenCOntract.address, (1*10**5).toString());
            console.log("\t can withdraw BTC from contract : ", canWithdrawBtc);

            // const withdrawCollateralTxn1 = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(wbtcTokenCOntract.address, (1*10**5).toString());
            // console.log("withdraw btc txn hash : ", withdrawCollateralTxn1.hash);

            const userBasicsInLnB1 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log("\t user basics in LnB :", userBasicsInLnB1);

            const userBasicsInComet1 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log("\t contracts basics in comet : ", userBasicsInComet1.principal);

            
            const timeStampBefore = await lendingBorrowingContract.getTimeStamp();
            console.log("\t timestamp before : ", timeStampBefore.toString());

            const userBorrowBalanceBefore = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log("\t borrow balance of user : ", userBorrowBalanceBefore.toString());

            const userBalanceBefore = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t balance of user : ", userBalanceBefore.toString());

            const cometBorrowBalanceBefore = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log("\t comet borrow balance : ",cometBorrowBalanceBefore.toString());

            const cometBalanceBefore = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log("\t comet balance : ", cometBalanceBefore.toString());

            const borrawableAmountBefore = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmountBefore.toString());
            
            // const withdrawTxn2 = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, borrawableAmount1.toString());
            // console.log("borrow txn2 : ", withdrawTxn2.hash);

            // const borrawableAmount2 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            // console.log('\t user borrowable amount : ', borrawableAmount2.toString());
            
            console.log("\t skipping some time ...................");
            await time.increase(8000);

            const userBorrowBalance1 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log("\t borrow balance of user : ", userBorrowBalance1.toString());

            const userBalance1 = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t balance of user : ", userBalance1.toString());

            const cometBorrowBalance1 = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log("\t comet borrow balance : ",cometBorrowBalance1.toString());

            const cometBalance1 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log("\t comet balance : ", cometBalance1.toString());

            const borrawableAmount1 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount1.toString());
            
            const timeStampAfter = await lendingBorrowingContract.getTimeStamp();
            console.log("\t timestamp after : ", timeStampAfter.toString());


            
            const approveUsdcTxn = await usdcTokenContract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, (max_uint).toString());
            console.log("\t usdc approve txn : ", approveUsdcTxn.hash);

            const repayTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(usdcTokenContract.address, (max_uint).toString());
            console.log("\t repay txn hash : ", repayTxn.hash);

            const cometBorrowBalance2 = await cometContractInstance.borrowBalanceOf(lendingBorrowingContract.address);
            console.log("\t comet borrow balance : ",cometBorrowBalance2.toString());

            const cometBalance2 = await cometContractInstance.balanceOf(lendingBorrowingContract.address);
            console.log("\t comet balance : ", cometBalance2.toString());

            const userBorrowBalance2 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log("\t borrow balance of user : ", userBorrowBalance2.toString());

            const userBalance2 = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log("\t balance of user : ", userBalance2.toString());

            const userBasicsInLnB2 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log("\t user basics in LnB :", userBasicsInLnB2);

            const userBasicsInComet2 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
            console.log("\t contracts basics in comet : ", userBasicsInComet2.principal);

            const borrawableAmount2 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t user borrowable amount : ', borrawableAmount2.toString());
            
        })
    })

});    