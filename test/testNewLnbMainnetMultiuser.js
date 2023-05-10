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

    describe("Testing multi user", () => {
        it("should allow LNB to multiple user : ", async () => {
            const { lendingBorrowingContract, cometContractInstance, wbtcImpersonatedSigner, UsdcEthImpersonatedSigner, wbtcTokenCOntract, wethTokenContract, usdcTokenContract, addr1 } = await loadFixture(deployLendingBorrowingContract);

            console.log("\t SUPPLY")
                console.log("\n");
                console.log("\t USER 1");

                    const wethAmount = 2 * 10**18; // 2 WETH

                    const depositEthUser1Txn = await wethTokenContract.connect(UsdcEthImpersonatedSigner).deposit({value: wethAmount.toString()});
                    console.log("\t\t user 1 deposit txn hash : ", depositEthUser1Txn.hash);

                    const balanceOfUser1Before = await wethTokenContract.balanceOf(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 balance of weth before supply : ", balanceOfUser1Before.toString());

                    const user1ApproveWethTxn = await wethTokenContract.connect(UsdcEthImpersonatedSigner).approve(lendingBorrowingContract.address, wethAmount.toString());
                    console.log("\t\t user weth approve txn hash : ", user1ApproveWethTxn.hash);

                    const user1SupplyWethTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).supply(wethTokenContract.address, wethAmount.toString());
                    console.log("\t\t user 1 weth supply txn hash : ", user1SupplyWethTxn.hash);

                    const user1BalanceOfWethAfterSupply = await wethTokenContract.balanceOf(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 weth balance after supply : ", user1BalanceOfWethAfterSupply.toString());
                    console.log("\t\t amount supplied : ", (balanceOfUser1Before - user1BalanceOfWethAfterSupply).toString());

                    const user1PrincipalAfterSupplyWeth = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 principal after weth supply : ", user1PrincipalAfterSupplyWeth.toString());

                    const user1BorroableAmountAfterSupplyWeth = await lendingBorrowingContract.getBorrowableAmount(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 borrowable amount after supply : ", user1BorroableAmountAfterSupplyWeth.toString());

                    // const user1BorroableAmountAfterSupplyWethV2 = await lendingBorrowingContract.getBorrowableAmount3(UsdcEthImpersonatedSigner.address);
                    // console.log("\t\t user 1 borrowable amount after supply : ", user1BorroableAmountAfterSupplyWethV2.toString());

                    const user1WethCollateralBalance = await lendingBorrowingContract.userCollateral(UsdcEthImpersonatedSigner.address, wethTokenContract.address);
                    console.log("\t\t user 1 weth collateral balance : ", user1WethCollateralBalance.toString());

                console.log("\t COMET");

                    const lnbPrincipalAfterSupplyInComet = await cometContractInstance.userBasic(lendingBorrowingContract.address);
                    console.log("\t\t LnB contract principal after supply : ", lnbPrincipalAfterSupplyInComet);

                    const lnbColletralBalanceInComet = await cometContractInstance.userCollateral(lendingBorrowingContract.address, wethTokenContract.address);
                    console.log("\t\t LnB contract weth collateral balance : ",lnbColletralBalanceInComet.balance.toString());


                console.log("\t USER 2");  

                    const wbtcAmount = 1 * 10**7 // 0.1 WBTC

                    const user2BalanceOfWbtcBefore = await wbtcTokenCOntract.balanceOf(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 wbtc balance before : ", user2BalanceOfWbtcBefore.toString());

                    const user2ApproveWbtcTxn = await wbtcTokenCOntract.connect(wbtcImpersonatedSigner).approve(lendingBorrowingContract.address, wbtcAmount.toString());
                    console.log("\t\t user 2 wbtc approve txn hash : ", user2ApproveWbtcTxn.hash);

                    const user2SupplyWbtcTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).supply(wbtcTokenCOntract.address, wbtcAmount.toString());
                    console.log("\t\t user 2 wbtc supply txn hash : ", user2SupplyWbtcTxn.hash);

                    const user2BalanceOfWbtcAfter = await wbtcTokenCOntract.balanceOf(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 wbtc balance after supply : ", user2BalanceOfWbtcAfter.toString());
                    console.log("\t\t wbtc supplied : ", (user2BalanceOfWbtcBefore - user2BalanceOfWbtcAfter).toString());

                    const user2PrincipalAfterSupplyWbtc = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 principal after wbtc supply : ", user2PrincipalAfterSupplyWbtc.toString());

                    const user2BorroableAmountAfterSupplyWbtc = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 borrowable amount after supply : ", user2BorroableAmountAfterSupplyWbtc.toString());

                    // const user2BorroableAmountAfterSupplyWbtcV2 = await lendingBorrowingContract.getBorrowableAmount3(wbtcImpersonatedSigner.address);
                    // console.log("\t\t user 2 borrowable amount after supply : ", user2BorroableAmountAfterSupplyWbtcV2.toString());

                    const user2WbtcCollateralBalance = await lendingBorrowingContract.userCollateral(wbtcImpersonatedSigner.address, wbtcTokenCOntract.address);
                    console.log("\t\t user 2 wbtc collateral balance : ", user2WbtcCollateralBalance.toString());

                console.log("\t COMET");

                    const lnbPrincipalAfterSupplyInComet2 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
                    console.log("\t\t LnB contract principal after supply : ", lnbPrincipalAfterSupplyInComet2);

                    const lnbWethColletralBalanceInComet2 = await cometContractInstance.userCollateral(lendingBorrowingContract.address, wethTokenContract.address);
                    console.log("\t\t LnB contract weth collateral balance : ",lnbWethColletralBalanceInComet2.balance.toString());

                    const lnbWbtcColletralBalanceInComet2 = await cometContractInstance.userCollateral(lendingBorrowingContract.address, wbtcTokenCOntract.address);
                    console.log("\t\t LnB contract wbtc collateral balance : ", lnbWbtcColletralBalanceInComet2.balance.toString());
            
                console.log("\t BORROW ");
                console.log("\n");

                const max_uint = ethers.constants.MaxUint256;

                console.log("\t USER 1");
                
                    const user1BorrowTxn = await lendingBorrowingContract.connect(UsdcEthImpersonatedSigner).withdraw(usdcTokenContract.address, user1BorroableAmountAfterSupplyWeth.toString());
                    console.log("\t\t user 1 borrow txn hash : ", user1BorrowTxn.hash);

                    const user1PrincipalAfterBorrow = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
                    console.log(" \t\t user 1 principal after borrow : ", user1PrincipalAfterBorrow.toString());

                    const user1BorrowBalanceAfterBorrow = await lendingBorrowingContract.borrowBalanceOf(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 borrow balance after borrow : ", user1BorrowBalanceAfterBorrow.toString());

                    const user1BorrowableAmountAfterBorrow = await lendingBorrowingContract.getBorrowableAmount(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 borrowable amount after borrow : ", user1BorrowableAmountAfterBorrow.toString());

                    // const user1BorrowableAmountAfterBorrowV2 = await lendingBorrowingContract.getBorrowableAmount3(UsdcEthImpersonatedSigner.address);
                    // console.log("\t\t user 1 borrowable amount after borrow : ", user1BorrowableAmountAfterBorrowV2.toString());

                console.log("\t COMET");
                    
                    const lnbPrincipalAfterBorrow = await cometContractInstance.userBasic(lendingBorrowingContract.address);
                    console.log("\t\t LnB contracts principal after borrow : ", lnbPrincipalAfterBorrow);

                console.log("\t USER 2");

                    const user2BorrowTxn = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, /*user2BorroableAmountAfterSupplyWbtc*/(100*10**6).toString());
                    console.log("\t\t user 2 borrow txn hash : ", user2BorrowTxn.hash);

                    const user2PrincipalAfterBorrow = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
                    console.log(" \t\t user 2 principal after borrow : ", user2PrincipalAfterBorrow.toString());

                    const user2BorrowBalanceAfterBorrow = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 borrow balance after borrow : ", user2BorrowBalanceAfterBorrow.toString());

                    const user2BorrowableAmountAfterBorrow = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 borrowable amount after borrow : ", user2BorrowableAmountAfterBorrow.toString());

                    // const user2BorrowableAmountAfterBorrowV2 = await lendingBorrowingContract.getBorrowableAmount3(wbtcImpersonatedSigner.address);
                    // console.log("\t\t user 2 borrowable amount after borrow : ", user2BorrowableAmountAfterBorrowV2.toString());

                    const user2BorrowLeftOver = await lendingBorrowingContract.connect(wbtcImpersonatedSigner).withdraw(usdcTokenContract.address, (user2BorrowableAmountAfterBorrow).toString());
                    console.log("\t\t user 2 borrow left over usdc  : ", user2BorrowLeftOver.hash);
                    
                    const user2PrincipalAfterBorrowFinal = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
                    console.log(" \t\t user 2 principal after borrow : ", user2PrincipalAfterBorrowFinal.toString());

                    const user2BorrowBalanceAfterBorrowFinal = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 borrow balance after borrow : ", user2BorrowBalanceAfterBorrowFinal.toString());

                    const user2BorrowableAmountAfterBorrowFinal = await lendingBorrowingContract.getBorrowableAmount(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 borrowable amount after borrow : ", user2BorrowableAmountAfterBorrowFinal.toString());

                    // const user2BorrowableAmountAfterBorrowV2Final = await lendingBorrowingContract.getBorrowableAmount2(wbtcImpersonatedSigner.address);
                    // console.log("\t\t user 2 borrowable amount after borrow : ", user2BorrowableAmountAfterBorrowV2Final.toString());


                    
                console.log("\t COMET");
                    
                    const lnbPrincipalAfterBorrow2 = await cometContractInstance.userBasic(lendingBorrowingContract.address);
                    console.log("\t\t LnB contracts principal after borrow : ", lnbPrincipalAfterBorrow2);

                console.log("\t Skipping sometime....");
                await time.increase(5000);

                console.log("\t USER 1");

                    const user1PrincipalAfterTimeSkip = await lendingBorrowingContract.userBasic(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 principal after some time : ", user1PrincipalAfterTimeSkip.toString());

                    const user1BorrowBalanceAfterTimeSkip = await lendingBorrowingContract.borrowBalanceOf(UsdcEthImpersonatedSigner.address);
                    console.log("\t\t user 1 borrow balance : ", user1BorrowBalanceAfterTimeSkip.toString());

                console.log("\t USER 2");

                    const user2PrincipalAfterTimeSkip = await lendingBorrowingContract.userBasic(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 2 principal after some time : ", user2PrincipalAfterTimeSkip.toString());

                    const user2BorrowBalanceAfterTimeSkip = await lendingBorrowingContract.borrowBalanceOf(wbtcImpersonatedSigner.address);
                    console.log("\t\t user 1 borrow balance : ", user2BorrowBalanceAfterTimeSkip.toString());

                console.log("\t COMET");

                    const lnbPrincipalAfterTimeSkip = await cometContractInstance.userBasic(lendingBorrowingContract.address);
                    console.log("\t\t LnB contracts principal after borrow : ", lnbPrincipalAfterTimeSkip);
        })
    });    
})