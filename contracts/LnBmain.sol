// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.11;

////
// import "hardhat/console.sol";
////

import "./LnBcore.sol";

import "./OwnableUpgradeable.sol";
import "./Initializable.sol";
import "./UUPSUpgradeable.sol";

contract LnB is LnBcore, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _cometAddress/*, uint64 setBorrowFactorDecreaser*/,uint16 _targetBaseReserve,uint16 _targetCollateralReserve) public initializer {
        cometAddress = _cometAddress;
        baseScale = Comet(cometAddress).baseScale();
        baseIndexScale = Comet(cometAddress).baseIndexScale();
        baseBorrowMin = Comet(cometAddress).baseBorrowMin();
        baseToken = Comet(cometAddress).baseToken();
        numAssets = Comet(cometAddress).numAssets();
        targetBaseReserve = _targetBaseReserve;
        targetCollateralReserve = _targetCollateralReserve;
        collateralAssetBorrowDecrease = 5*1e16/*setBorrowFactorDecreaser*/; // 5% for now
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * Get asset info by address
     * @param asset address asset to get
     */
    function getAssetInfoByAddress(
        address asset
    ) public view returns (CometStructs.AssetInfo memory) {
        Comet comet = Comet(cometAddress);
        CometStructs.AssetInfo memory assetInfo = comet.getAssetInfoByAddress(asset);

        uint64 borrowCollateralFactorNew = assetInfo.borrowCollateralFactor - collateralAssetBorrowDecrease;
        uint64 liquidationCollateralFactorNew = assetInfo.liquidateCollateralFactor - collateralAssetBorrowDecrease;

        assetInfo.borrowCollateralFactor = borrowCollateralFactorNew;
        assetInfo.liquidateCollateralFactor = liquidationCollateralFactorNew;

        return assetInfo;
    }

    /**
     * Get asset details
     * @param i Asset
     */
    function getAssetInfo(
        uint8 i
    ) public view returns (CometStructs.AssetInfo memory) {
        Comet comet = Comet(cometAddress);
        CometStructs.AssetInfo memory assetInfo = comet.getAssetInfo(i);
        // console.log(assetInfo.borrowCollateralFactor / 1e16);
        uint64 borrowCollateralFactorNew = assetInfo.borrowCollateralFactor - collateralAssetBorrowDecrease;
        uint64 liquidationCollateralFactorNew = assetInfo.liquidateCollateralFactor - collateralAssetBorrowDecrease;

        // console.log(borrowCollateralFactorNew / 1e16);
        assetInfo.borrowCollateralFactor = borrowCollateralFactorNew;
        assetInfo.liquidateCollateralFactor = liquidationCollateralFactorNew;
        // need to decrase the asset valuation
        return assetInfo;
    }

    /**
     * @notice Query the current negative base balance of an account or zero
     * @dev Note: uses updated interest indices to calculate
     * @param account The account whose balance to query
     * @return The present day base balance magnitude of the account, if negative
     */
    function borrowBalanceOf(address account) public view returns (uint256) {
        Comet comet = Comet(cometAddress);
        uint64 lat = comet.totalsBasic().lastAccrualTime;
        (, uint64 baseBorrowIndex_) = accruedInterestIndices(
            block.timestamp - lat
        );
        int104 principal = userBasic[account].principal;
        return
            principal < 0
                ? presentValueBorrow(baseBorrowIndex_, unsigned104(-principal))
                : 0;
    }

    /**
     * @notice Query the current positive base balance of an account or zero
     * @dev Note: uses updated interest indices to calculate
     * @param account The account whose balance to query
     * @return The present day base balance magnitude of the account, if positive
     */
    function balanceOf(address account) public view returns (uint256) {
        Comet comet = Comet(cometAddress);
        int104 principal = userBasic[account].principal;
        uint64 lat = comet.totalsBasic().lastAccrualTime;
        (uint64 baseSupplyIndex_, ) = accruedInterestIndices(
            block.timestamp - lat
        );
        // int104 liquidationLeftOver = userBasic[account].liquidatedLeftOver;
        // principal = principal - liquidationLeftOver; // 

        return
            principal > 0
                ? presentValueSupply(baseSupplyIndex_, unsigned104(principal))
                : 0;
    }

    /*
     * Get the current price of an asset from the protocol's persepctive
     */
    function getCompoundPrice(
        address singleAssetPriceFeed
    ) public view returns (uint) {
        Comet comet = Comet(cometAddress);
        return comet.getPrice(singleAssetPriceFeed);
    }

    function getBorrowableAmount(address account) public view returns (int) {
        Comet comet = Comet(cometAddress);
        uint8 numAssets = numAssets;

        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        int liquidity = signedMulPrice(
            presentValue(userBasic[account].principal - userBasic[account].liquidatedLeftOver),
            getCompoundPrice(baseTokenPriceFeed),
            uint64(baseScale)
        );

        for (uint8 i = 0; i < numAssets; ) {
            if (isInAsset(account, i)) {
                CometStructs.AssetInfo memory asset = getAssetInfo(i);

                uint newAmount = mulPrice(
                    userCollateral[account][asset.asset],
                    getCompoundPrice(asset.priceFeed),
                    asset.scale
                );

                liquidity += int(
                    (newAmount * asset.borrowCollateralFactor) / 1e18
                );
            }
            unchecked {
                i++;
            }
        }

        return (liquidity / 1e8) * int(baseScale);
    }

    /**
     * @notice Check whether an account has enough collateral to borrow
     * @param account The address to check
     * @return Whether the account is minimally collateralized enough to borrow
     */
    function isBorrowCollateralized(
        address account
    ) public view returns (bool) {
        Comet comet = Comet(cometAddress);

        int104 principal = userBasic[account].principal;

        uint8 numAssets = numAssets;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        if (principal >= 0) {
            return true;
        }

        int liquidity = signedMulPrice(
            presentValue(principal),
            getCompoundPrice(baseTokenPriceFeed),
            uint64(baseScale)
        );

        for (uint8 i = 0; i < numAssets; ) {
            if (isInAsset(account, i)) {
                if (liquidity >= 0) {
                    return true;
                }

                CometStructs.AssetInfo memory asset = getAssetInfo(i);

                uint newAmount = mulPrice(
                    userCollateral[account][asset.asset],
                    getCompoundPrice(asset.priceFeed),
                    asset.scale
                );

                liquidity += int256(
                    mulFactor(newAmount, asset.borrowCollateralFactor)
                );
            }
            unchecked {
                i++;
            }
        }

        return liquidity >= 0;
    }

    function canWithdrawExtraCollateral(
        address account,
        address asset,
        uint amount
    ) external view returns (bool) {
        require(amount > 0, "invalid amount");

        require(
            userCollateral[account][asset] >= amount,
            "No such asset supplied or invalid balance"
        );

        Comet comet = Comet(cometAddress);

        int104 principal = userBasic[account].principal;
        uint8 numAssets = numAssets;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        if (principal >= 0) {
            return true;
        }

        int liquidity = signedMulPrice(
            presentValue(principal),
            getCompoundPrice(baseTokenPriceFeed),
            uint64(baseScale)
        );

        for (uint8 i = 0; i < numAssets; ) {
            if (isInAsset(account, i)) {
                if (liquidity >= 0) {
                    return true;
                }

                CometStructs.AssetInfo memory AssetInfo = getAssetInfo(i);
                uint newAmount = mulPrice(
                    AssetInfo.asset == asset
                        ? userCollateral[account][AssetInfo.asset] -
                            amount
                        : userCollateral[account][AssetInfo.asset],
                    getCompoundPrice(AssetInfo.priceFeed),
                    AssetInfo.scale
                );

                liquidity += int256(
                    mulFactor(newAmount, AssetInfo.borrowCollateralFactor)
                );
            }
            unchecked {
                i++;
            }
        }

        return liquidity >= 0;
    }

    /**
     * @notice Check whether an account has enough collateral to not be liquidated
     * @param account The address to check
     * @return Whether the account is minimally collateralized enough to not be liquidated
     */
    function isLiquidatable(address account) public view returns (bool) {
        int104 principal = userBasic[account].principal;

        if (principal >= 0) {
            return false;
        }

        Comet comet = Comet(cometAddress);

        uint8 numAssets = numAssets;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        int liquidity = signedMulPrice(
            presentValue(principal),
            getCompoundPrice(baseTokenPriceFeed),
            uint64(baseScale)
        );

        // if(liquidity > 0){
        //     console.log('+ve');
        //     console.log(uint(liquidity));
        // } else {
        //     console.log('-ve');
        //     console.log(uint(-liquidity));
        // }

        for (uint8 i = 0; i < numAssets; ) {
            if (isInAsset(account, i)) {
                if (liquidity >= 0) {
                    return false;
                }

                CometStructs.AssetInfo memory asset = getAssetInfo(i);
                uint newAmount = mulPrice(
                    userCollateral[account][asset.asset],
                    getCompoundPrice(asset.priceFeed) - (getCompoundPrice(asset.priceFeed) / 10), // changeback only for testing
                    asset.scale
                );

                // console.log('newamount');
                // console.log(newAmount);
                liquidity += signed256(mulFactor(
                    newAmount,
                    asset.liquidateCollateralFactor
                ));
                
                // if(liquidity > 0){
                //     console.log('+ve');
                //     console.log(uint(liquidity));
                // } else {
                //     console.log('-ve');
                //     console.log(uint(-liquidity));
                // }
            }
            unchecked { i++; }
        }

        return liquidity < 0;
    }


     /**
     * @notice Absorb a list of underwater accounts onto the protocol balance sheet
     * @param absorber The recipient of the incentive paid to the caller of absorb
     * @param accounts The list of underwater accounts to absorb
     */
    function absorb(address absorber, address[] calldata accounts) external {
        // if (isAbsorbPaused()) revert Paused();

        uint startGas = gasleft();
        // accrueInternal();
        for (uint i = 0; i < accounts.length; ) {
            absorbInternal(absorber, accounts[i]);
            unchecked { i++; }
        }
        uint gasUsed = startGas - gasleft();

        // Note: liquidator points are an imperfect tool for governance,
        //  to be used while evaluating strategies for incentivizing absorption.
        // Using gas price instead of base fee would more accurately reflect spend,
        //  but is also subject to abuse if refunds were to be given automatically.
        CometStructs.LiquidatorPoints memory points = liquidatorPoints[absorber];
        points.numAbsorbs++;
        points.numAbsorbed += safe64(accounts.length);
        points.approxSpend += safe128(gasUsed * block.basefee);
        liquidatorPoints[absorber] = points;
    }

     /**
     * @dev Transfer user's collateral and debt to the protocol itself.
     */
    function absorbInternal(address absorber, address account) internal {
        if (!isLiquidatable(account)) revert('NotLiquidatable');

        int104 oldPrincipal = userBasic[account].principal;
        int256 oldBalance = presentValue(oldPrincipal);

        // paying full borrowed amount 
        repayUnderwater(account);

        Comet comet = Comet(cometAddress);

        uint8 numAssets = numAssets;
        address baseTokenPriceFeed = comet.baseTokenPriceFeed();

        uint256 basePrice = getCompoundPrice(baseTokenPriceFeed);
        uint256 deltaValue = 0;

        for (uint8 i = 0; i < numAssets; ) {
            if (isInAsset(account, i)) {
                CometStructs.AssetInfo memory assetInfo = getAssetInfo(i);
                address asset = assetInfo.asset;
                uint128 seizeAmount = userCollateral[account][asset];
               
                userCollateral[account][asset] = 0;
                                                                                               // testing prpose only !!!!!
                uint256 value = mulPrice(seizeAmount,(getCompoundPrice(assetInfo.priceFeed) - (getCompoundPrice(assetInfo.priceFeed) / 10)), assetInfo.scale);
                deltaValue += mulFactor(value, assetInfo.liquidationFactor); // deducting potocals fine for getting liquidated

                getCollateralReserves[asset] += seizeAmount; // storing tokens for sale, but not transfering them back gas saving

                emit AbsorbCollateral(absorber, account, asset, seizeAmount, value);
            }
            unchecked { i++; }
        }

        uint256 deltaBalance = divPrice(deltaValue, basePrice, uint64(baseScale));
      
        int256 newBalance = oldBalance + signed256(deltaBalance);
        // New balance will not be negative, all excess debt absorbed by reserves
        if (newBalance < 0) {
            newBalance = 0;
        }

        int104 newPrincipal = principalValue(newBalance);
      
        userBasic[account].principal = 0;
        userBasic[account].liquidatedLeftOver = newPrincipal;
        // userBasic[account].isAbsorb = true; // user set as absorb account

        uint256 basePaidOut = unsigned256(newBalance - oldBalance);
        uint256 valueOfBasePaidOut = mulPrice(basePaidOut, basePrice, uint64(baseScale));

        emit AbsorbDebt(absorber, account, basePaidOut, valueOfBasePaidOut);

        // if (newPrincipal > 0) { // if any earning 
        //     uint64 si = Comet(cometAddress).totalsBasic().baseSupplyIndex;
        //     emit Transfer(address(0), account, presentValueSupply(si, unsigned104(newPrincipal)));
        // }

    }

    /**
     * @dev to repay full borrowed balance of user, for taking collateral of liquidated accounts
     */
    function repayUnderwater(address liquidated) internal {

        // chcecking protocals balance to repay
        uint baseBalance = ERC20(baseToken).balanceOf(address(this));

        uint borrowedBalance = borrowBalanceOf(liquidated);

        uint tragetBaseReserveToHold = targetBaseReserve * baseScale;
        // console.log('reserve info');
        // console.log(baseBalance);
        // console.log(tragetBaseReserveToHold);
        // console.log(borrowedBalance);

        if(baseBalance - tragetBaseReserveToHold  < borrowedBalance){
            revert ('insufficient base in protocal');
        }

        // approve 
        ERC20(baseToken).approve(cometAddress, borrowedBalance);

        // repaying full
        Comet(cometAddress).supply(baseToken, borrowedBalance);

    }

    /**
     * @notice Buy collateral from the protocol using base tokens, increasing protocol reserves
       A minimum collateral amount should be specified to indicate the maximum slippage acceptable for the buyer.
     * @param asset The asset to buy
     * @param minAmount The minimum amount of collateral tokens that should be received by the buyer
     * @param baseAmount The amount of base tokens used to buy the collateral
     * @param recipient The recipient address
     */
    function buyCollateral(address asset, uint minAmount, uint baseAmount, address recipient) external {
        // if (isBuyPaused()) revert Paused();

        int reserves = signed256(getCollateralReserves[asset]);
        // uint decimals = ERC20(asset).decimals();
        if (reserves == 0 /*&& uint(reserves) <= targetCollateralReserve * 10**(decimals - 1)*/) revert('NotForSale');

        // Note: Re-entrancy can skip the reserves check above on a second buyCollateral call.
        // doTransferIn(baseToken, msg.sender, baseAmount);
        ERC20(baseToken).transferFrom(msg.sender, address(this), baseAmount);

        uint collateralAmount = quoteCollateral(asset, baseAmount);
        if (collateralAmount < minAmount) revert('TooMuchSlippage');
        if (collateralAmount > getCollateralReserves[asset]) revert('InsufficientReserves');

        getCollateralReserves[asset] -= safe128(collateralAmount);

        // Note: Pre-transfer hook can re-enter buyCollateral with a stale collateral ERC20 balance.
        //  Assets should not be listed which allow re-entry from pre-transfer now, as too much collateral could be bought.
        //  This is also a problem if quoteCollateral derives its discount from the collateral ERC20 balance.
        // doTransferOut(asset, recipient, safe128(collateralAmount));
        // ERC20(asset).transfer(recipient, safe128(collateralAmount));
        Comet(cometAddress).withdrawTo(recipient, asset, collateralAmount);

        emit BuyCollateral(msg.sender, asset, baseAmount, collateralAmount);
    }

    /**
     * Function allows absorb account to either supply the liquidity to protocal or withdraw
     * Both require enough funds in protocol
     */
    function liquidatedSupplyOrWithdraw(address recipient, uint amount, bool withdrawLeftOver) external {
        userBasics memory userInfo = userBasic[msg.sender];
        
        require(userInfo.liquidatedLeftOver > 0,'only liquidated account');
        
        uint balanceOfUser = unsigned256(getLiquidatedAccountLeftAmount(msg.sender));

        require(amount > 0 && amount <= balanceOfUser,'invalid amount requested');

        uint balanceOfProtocol = ERC20(baseToken).balanceOf(address(this));
        uint tragetBaseReserveToHold = targetBaseReserve * baseScale;

        // console.log('balance fo protocol');
        // console.log(balanceOfProtocol);
        // console.log(tragetBaseReserveToHold);

        require(balanceOfProtocol - tragetBaseReserveToHold >= balanceOfUser  ,'Not enough funds in protocal');

        if(withdrawLeftOver){
            ERC20(baseToken).transfer(recipient, amount);
        }else{
            // Comet(cometAddress).supply(baseToken, amount);
            supplyBase(recipient, amount);
        }

        int104 srcPrincipal = userInfo.liquidatedLeftOver;
        int256 srcBalanceNew = presentValue(srcPrincipal) - signed256(amount);
        int104 srcPrincipalNew = principalValue(srcBalanceNew);

        userBasic[msg.sender].liquidatedLeftOver = srcPrincipalNew;

    }


    /**
     * @notice Withdraw an amount of asset from the protocol
     * @param asset The asset to withdraw
     * @param amount The quantity to withdraw
     */
    function withdraw(address asset, uint amount) external {
        return withdrawInternal(msg.sender, asset, amount);
    }

    /**
     * @dev Withdraw either collateral or base asset, depending on the asset
     * @dev Note: Specifying an `amount` of uint256.max will withdraw all of `src`'s accrued base balance
     */
    function withdrawInternal(
        address src,
        address asset,
        uint amount
    ) internal {
        // if (isWithdrawPaused()) revert Paused();
        // if(isAbsorbPaused(src)) revert('user Absorb Paused');

        Comet comet = Comet(cometAddress);

        if (asset == comet.baseToken()) {
            // when have supplied base tokens and want to withdraw all
            if (amount == type(uint256).max) {
                amount = balanceOf(src);
            }
            return withdrawBase(src, asset, amount);
        } else {
            return withdrawCollateral(src, asset, safe128(amount));
        }
    }

    /**
     * @dev Withdraw an amount of base asset from src to `to`, borrowing if possible/necessary
     */
    function withdrawBase(address src, address asset, uint256 amount) internal {
        require(
            userBasic[src].principal > 0 ? amount <= balanceOf(src) : int(amount) <= getBorrowableAmount(src),
            "invalid amount requested"
        );
        // require(amount >= baseBorrowMin,"BorrowtTooSmall");

        Comet(cometAddress).withdrawTo(src, asset, amount);

        int104 srcPrincipal = userBasic[src].principal;
        int256 srcBalance = presentValue(srcPrincipal) - signed256(amount);
        int104 srcPrincipalNew = principalValue(srcBalance);

        // (uint104 withdrawAmount, uint104 borrowAmount) = withdrawAndBorrowAmount(srcPrincipal, srcPrincipalNew);

        // totalSupplyBase -= withdrawAmount;
        // totalBorrowBase += borrowAmount;

        if (srcBalance < 0) {
            // means user is borrowing, not withdrawing his supplied base token
            if (uint256(-srcBalance) < baseBorrowMin) revert("BorrowTooSmall");
            if (!isBorrowCollateralized(src)) revert("NotCollateralized");
        }

        userBasic[src].principal = srcPrincipalNew;

        emit WithdrawBase(src, amount);
    }

    /**
     * @dev Withdraw an amount of collateral asset from src to `to`
     */
    function withdrawCollateral(
        address src,
        address asset,
        uint128 amount
    ) internal {
        uint128 srcCollateral = userCollateral[src][asset];
        uint128 srcCollateralNew = srcCollateral - amount;

        userCollateral[src][asset] = srcCollateralNew;

        // Note: no accrue interest, BorrowCF < LiquidationCF covers small changes
        if (!isBorrowCollateralized(src)) revert("NotCollateralized");

        Comet(cometAddress).withdrawTo(src, asset, amount);

        emit WithdrawCollateral(src, asset, amount);
    }



    /**
     * @notice Supply an amount of asset to the protocol
     * @param asset The asset to supply
     * @param amount The quantity to supply
     */
    function supply(address asset, uint amount) external {
        return supplyInternal(msg.sender, asset, amount);
    }

    /**
     * @dev Supply either collateral or base asset, depending on the asset, if operator is allowed
     * @dev Note: Specifying an `amount` of uint256.max will repay all of `dst`'s accrued base borrow balance
     */
    function supplyInternal(address dst, address asset, uint amount) internal {
        // if (isWithdrawPaused()) revert Paused();
        // if(isAbsorbPaused(dst)) revert('user Absorb Paused');

        Comet comet = Comet(cometAddress);

        if (asset == comet.baseToken()) {
            if (amount == type(uint256).max) {
                amount = borrowBalanceOf(dst);
            }
            return supplyBase(dst, amount);
        } else {
            return supplyCollateral(dst, asset, safe128(amount));
        }
    }

    /**
     * @dev Supply an amount of base asset
     */
    function supplyBase(address dst, uint256 amount) internal {
        require(
            ERC20(baseToken).allowance(dst, address(this)) >= amount,
            "Insufficient amount approved"
        );

        doTransferIn(baseToken, dst, amount);

        int104 dstPrincipal = userBasic[dst].principal;
        int256 dstBalance = presentValue(dstPrincipal) + signed256(amount);
        int104 dstPrincipalNew = principalValue(dstBalance);

        // (uint104 repayAmount, uint104 supplyAmount) = repayAndSupplyAmount(dstPrincipal, dstPrincipalNew);

        // totalSupplyBase += supplyAmount;
        // totalBorrowBase -= repayAmount;

        userBasic[dst].principal = dstPrincipalNew;

        emit SupplyBase(dst, amount);
    }

    /**
     * @dev Supply an amount of collateral asset
     */
    function supplyCollateral(
        address dst,
        address asset,
        uint128 amount
    ) internal {
        CometStructs.AssetInfo memory assetInfo = getAssetInfoByAddress(asset);

        require(assetInfo.asset != address(0), "invalid asset supplying");
        require(
            ERC20(asset).allowance(dst, address(this)) >= amount,
            "Insufficient approved amount"
        );

        Comet comet = Comet(cometAddress);

        CometStructs.TotalsCollateral memory totals = comet.totalsCollateral(
            asset
        );

        totals.totalSupplyAsset += amount;
        
        if (totals.totalSupplyAsset > assetInfo.supplyCap)
            revert("SupplyCapExceeded");

        doTransferIn(asset, dst, amount);

        userCollateral[dst][asset] += amount;

        emit SupplyCollateral(dst, asset, amount);
    }
}
