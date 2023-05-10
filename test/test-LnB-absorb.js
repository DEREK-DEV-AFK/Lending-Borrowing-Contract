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
        const lendingBorrowingContract = await upgrades.deployProxy(LnBcontract, [CUSDC_MAINNET_ADDRESS, 50000, 1]);
        await lendingBorrowingContract.deployed();
        // const lendingBorrowingContract = await LnBcontract.deploy(CUSDC_MAINNET_ADDRESS);


    
        return { lendingBorrowingContract, UsdcEthImpersonatedSigner, wbtcImpersonatedSigner, usdcTokenContract, wbtcTokenCOntract, wethTokenContract, cometContractInstance, cometRewardContract, compTokenContract, addr1, addr2, addr3, addr4 };
    }

    describe('testing', () => {
        it('aborb : ', async () => {
            const { lendingBorrowingContract, usdcTokenContract, wbtcImpersonatedSigner, wbtcTokenCOntract, addr1, UsdcEthImpersonatedSigner, wethTokenContract} = await loadFixture(deployLendingBorrowingContract);

            const wbtcAmount = 1 * 10**8;
            const wethAmount = 5 * 10**18;

            const approveTxn = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wbtcAmount.toString());

            const supplyTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, (1*1e7).toString());

            const depositEthTxn = await wethTokenContract.connect(wbtcImpersonatedSigner).deposit({value: (wethAmount).toString()});

            const balanceOfUserInWeth = await wethTokenContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log('\t balance of user in weth is : ', balanceOfUserInWeth.toString());

            const approveWethTxn = await wethTokenContract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wethAmount.toString());
            console.log('\t weth approve txn hash : ', approveWethTxn.hash);

            const supplyWethTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wethTokenContract.address, wethAmount.toString());
            console.log('\t weth supply txn hash : ', supplyWethTxn.hash);

            const borrawableAmount0 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('borrowable  amountof user : ', borrawableAmount0);

            const borrowTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, (borrawableAmount0).toString());
            console.log('\t borrow txn hash : ', borrowTxn.hash);

            const borrawableAmount1 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('borrowable  amountof user : ', borrawableAmount1.toString());

            const hourInSec = 60 * 60;
            const dayInSec = 24 * hourInSec;
            const weekInSec = 7 * dayInSec;
            const monthInSec = 4 * weekInSec;
            const yearInSec = 12 * monthInSec;
            const year1InSec = 1 * yearInSec;
            time.increase(year1InSec);

            
            // checking liquidatbale 
            const isAccountLiquidatable1 = await lendingBorrowingContract.isLiquidatable(wbtcImpersonatedSigner.address);
            console.log('\t is account liquidatable : ', isAccountLiquidatable1);

            // transfering some USDC to protocal to payback the underwater borrowec
            const transferUsdcTxn = await usdcTokenContract.connect(UsdcEthImpersonatedSigner).transfer(lendingBorrowingContract.address, (100000 * 10**6).toString()); 
            
            const balanceOfProtocal = await usdcTokenContract.balanceOf(lendingBorrowingContract.address);
            console.log('\t USDC balance of LnB before : ', balanceOfProtocal.toString());

            const userPricinpal0 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log('\t user pricipal before absorb : ', userPricinpal0.toString());

            const borrowBalanceOfUnderwaterBefore = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t borrowed amount : ', borrowBalanceOfUnderwaterBefore.toString());

            // absorbing
            const absorbTxn = await lendingBorrowingContract.absorb(addr1.address, [wbtcImpersonatedSigner.address]);
            console.log('\t absorb txn hash : ', absorbTxn.hash);

            const balanceOfProtocal1 = await usdcTokenContract.balanceOf(lendingBorrowingContract.address);
            console.log('\t USDC balance of LnB after : ', balanceOfProtocal1.toString());

            const userPricinpal1 = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log('\t user pricipal after absorb : ', userPricinpal1.toString());

            const borrowBalanceOfUnderwater = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t borrowed amount : ', borrowBalanceOfUnderwater.toString());

            const borrawableAmount = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t borrowable amount : ', borrawableAmount.toString());

            const leftOverValue = await lendingBorrowingContract.getLiquidatedAccountLeftAmount(wbtcImpersonatedSigner.address);
            console.log('\t left over value : ', Number(leftOverValue));

            const balanceOf = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log('\t balance of user : ', balanceOf.toString());

            console.log('SUPPLYING USER ');
            const approveWbtcAgain2 = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, (1*1e7).toString());

            const supplyColAgain2 = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, (1*1e7).toString());
            console.log('\t user supply collateral  agian : ',supplyColAgain2.hash);

            const borrowBalanceOfUser2 = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t borrowed amount : ', borrowBalanceOfUser2.toString());

            const borrawableAmountAgain2 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t borrowable amount : ', borrawableAmountAgain2.toString());

            const userPricinpal1Again = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log('\t user pricipal after absorb : ', userPricinpal1Again.toString());

            const borrowBalanceOfUnderwaterAgain = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t borrowed amount : ', borrowBalanceOfUnderwaterAgain.toString());

            const borrawableAmountAgain1 = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t borrowable amount : ', borrawableAmountAgain1.toString());

            const leftOverValueAgain = await lendingBorrowingContract.getLiquidatedAccountLeftAmount(wbtcImpersonatedSigner.address);
            console.log('\t left over value : ', Number(leftOverValueAgain));

            const balanceOfAgain = await lendingBorrowingContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log('\t balance of user : ', balanceOfAgain.toString());

            // getting token for sale 
            console.log('\t TOKEN SALE INFO');
            const tokenForSale = await lendingBorrowingContract.getCollateralReserves(wbtcTokenCOntract.address);
            console.log('\t wbtc token for sale : ', Number(tokenForSale) / 1e8);

            const tokenForsale2 = await lendingBorrowingContract.getCollateralReserves(wethTokenContract.address);
            console.log('\t weth token for sale : ', Number(tokenForsale2)/ 1e18);

            const tokenForSale1 = await lendingBorrowingContract.getCollateralReserves(usdcTokenContract.address);
            console.log('\t usdc token for sale : ', Number(tokenForSale1) / 1e6);

            const quoteAmount = 2500*10**6;
            const quoteAmountWeth = 8185*10**6;

            const quteCollateral = await lendingBorrowingContract.quoteCollateral(wbtcTokenCOntract.address, (quoteAmount).toString());
            console.log('\t',quoteAmount / 1e6, 'usdc qoute for wbtc tokens is : ', Number(quteCollateral) / 1e8);

            const quoteCollateralWeth = await lendingBorrowingContract.quoteCollateral(wethTokenContract.address, (quoteAmountWeth).toString());
            console.log('\t qoute for weth token is : ', Number(quoteCollateralWeth) / 1e18," for ",Number(quoteAmountWeth) / 1e6);

            const totalUserTaken = Number(borrawableAmount0) + Number(leftOverValue);
            console.log('\t user has taken : ', totalUserTaken);

            const soldPrice = quoteAmount + quoteAmountWeth
            console.log('\t user collatwral sold at : ', soldPrice);

            const profitEarnByProtocol = (quoteAmount + quoteAmountWeth - totalUserTaken) / 10**6;
            console.log('\t profit of protocol : ', profitEarnByProtocol);

            // buying collaterla as buyer

            console.log('\t BUYING');

            const approveBuyTxn = await usdcTokenContract.connect(UsdcEthImpersonatedSigner).approve(lendingBorrowingContract.address, (quoteAmount + quoteAmountWeth).toString());
            console.log('\t approve usdc : ', approveBuyTxn.hash);

            const buyTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).buyCollateral(wbtcTokenCOntract.address, (9*1e6).toString(), (quoteAmount).toString(), addr1.address);
            console.log('\t buy txn hash : ', buyTxn.hash);

            const buyWethTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).buyCollateral(wethTokenContract.address, (4*10**18).toString(),quoteAmountWeth.toString(), addr1.address)

            const balanceOfUserInWbtc = await wbtcTokenCOntract.balanceOf(addr1.address);
            console.log('\t balance of user in wbtc : ', balanceOfUserInWbtc.toString());

            const protocalbalanceInUsdc = await usdcTokenContract.balanceOf(lendingBorrowingContract.address);
            console.log('\t balance of protocal after buying : ', protocalbalanceInUsdc.toString());

            const protocalsCollateralReserves = await lendingBorrowingContract.getCollateralReserves(wbtcTokenCOntract.address);
            console.log('\t protocols wbtc reserves balance : ', protocalsCollateralReserves.toString());

            const balanceOfLiquidated = await lendingBorrowingContract.getLiquidatedAccountLeftAmount(wbtcImpersonatedSigner.address);
            console.log('\t user left over liquidated amount :', balanceOfLiquidated.toString());

            // trying to add colletral 
            // const approveWbtcAgain = await usdcTokenContract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, (1*1e6).toString());
            
            // const supplyColAgain = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, (1*1e6).toString());
            // console.log('\t user supply collateral  agian : ',supplyColAgain.hash);

            const withdrawLiquidatedUserLeftAmount = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).liquidatedSupplyOrWithdraw(wbtcImpersonatedSigner.address, leftOverValue.toString(), true);
            console.log('\t withdraw left over txn hash : ',withdrawLiquidatedUserLeftAmount.hash );

            const balanceOfLiquidatedAccount = await usdcTokenContract.balanceOf(wbtcImpersonatedSigner.address);
            console.log('\t balance of usdc of liquidated account : ', balanceOfLiquidatedAccount.toString());

            const userLEftValue = await lendingBorrowingContract.getLiquidatedAccountLeftAmount(wbtcImpersonatedSigner.address);
            console.log('\t user current left over : ', userLEftValue.toString());

            const userBasicsLeft = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
            console.log('\t use basics : ', userBasicsLeft);

            const approveWbtcAgain = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, (1*1e7).toString());

            const supplyColAgain = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, (1*1e7).toString());
            console.log('\t user supply collateral  agian : ',supplyColAgain.hash);

            const borrowBalanceOfUser = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
            console.log('\t borrowed amount : ', borrowBalanceOfUser.toString());

            const borrawableAmountAgain = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
            console.log('\t borrowable amount : ', borrawableAmountAgain.toString());


        })
    })

});    