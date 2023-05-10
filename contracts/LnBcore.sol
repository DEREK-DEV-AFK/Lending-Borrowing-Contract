// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.11;

import "./LnBstorage.sol";
import "./Math.sol";

contract LnBcore is LnBstorage, Math {

    
    /*
     * Get the current supply APR in Compound III
     */
    function getSupplyApr() public view returns (uint) {
        Comet comet = Comet(cometAddress);
        uint utilization = comet.getUtilization();
        return comet.getSupplyRate(utilization);
    }

    /*
     * Get the current borrow APR in Compound III
     */
    function getBorrowApr() public view returns (uint) {
        Comet comet = Comet(cometAddress);
        uint utilization = comet.getUtilization();
        return comet.getBorrowRate(utilization);
    }

    /**
     * @dev Calculate accrued interest indices for base token supply and borrows
     **/
    function accruedInterestIndices(
        uint timeElapsed
    ) internal view returns (uint64, uint64) {
        Comet comet = Comet(cometAddress);
        CometStructs.TotalsBasic memory totalBasics = comet.totalsBasic();
        uint64 baseSupplyIndex_ = totalBasics.baseSupplyIndex;
        uint64 baseBorrowIndex_ = totalBasics.baseBorrowIndex;
        if (timeElapsed > 0) {
            uint utilization = comet.getUtilization();
            uint supplyRate = comet.getSupplyRate(utilization);
            uint borrowRate = comet.getBorrowRate(utilization);
            baseSupplyIndex_ += safe64(
                mulFactor(baseSupplyIndex_, supplyRate * timeElapsed)
            );
            baseBorrowIndex_ += safe64(
                mulFactor(baseBorrowIndex_, borrowRate * timeElapsed)
            );
        }
        return (baseSupplyIndex_, baseBorrowIndex_);
    }

    //  /**
    //  * @dev The change in principal broken into repay and supply amounts
    //  */
    // function repayAndSupplyAmount(int104 oldPrincipal, int104 newPrincipal) internal pure returns (uint104, uint104) {
    //     // If the new principal is less than the old principal, then no amount has been repaid or supplied
    //     if (newPrincipal < oldPrincipal) return (0, 0);

    //     if (newPrincipal <= 0) {
    //         return (uint104(newPrincipal - oldPrincipal), 0);
    //     } else if (oldPrincipal >= 0) {
    //         return (0, uint104(newPrincipal - oldPrincipal));
    //     } else {
    //         return (uint104(-oldPrincipal), uint104(newPrincipal));
    //     }
    // }

    //  /**
    //  * @dev The change in principal broken into withdraw and borrow amounts
    //  */
    // function withdrawAndBorrowAmount(int104 oldPrincipal, int104 newPrincipal) internal pure returns (uint104, uint104) {
    //     // If the new principal is greater than the old principal, then no amount has been withdrawn or borrowed
    //     if (newPrincipal > oldPrincipal) return (0, 0);

    //     if (newPrincipal >= 0) {
    //         return (uint104(oldPrincipal - newPrincipal), 0);
    //     } else if (oldPrincipal <= 0) {
    //         return (0, uint104(oldPrincipal - newPrincipal));
    //     } else {
    //         return (uint104(oldPrincipal), uint104(-newPrincipal));
    //     }
    // }

    /**
     * Function to get left over interest earn or collateral value left after absorb
     * @param account address of account
     */
    function getLiquidatedAccountLeftAmount(address account) public view returns(int256){
        return presentValue(userBasic[account].liquidatedLeftOver);
    }

    // function isAbsorbPaused(address account) public view returns(bool){
    //     return userBasic[account].liquidatedLeftOver > 0;
    // }

    /**
     * @notice Gets the quote for a collateral asset in exchange for an amount of base asset
     * @param asset The collateral asset to get the quote for
     * @param baseAmount The amount of the base asset to get the quote for
     * @return The quote in terms of the collateral asset
     */
    function quoteCollateral(address asset, uint baseAmount) public view returns (uint) {
        CometStructs.AssetInfo memory assetInfo = Comet(cometAddress).getAssetInfoByAddress(asset);
        uint256 assetPrice = Comet(cometAddress).getPrice(assetInfo.priceFeed) - (Comet(cometAddress).getPrice(assetInfo.priceFeed) / 10);
        // Store front discount is derived from the collateral asset's liquidationFactor and storeFrontPriceFactor
        // discount = storeFrontPriceFactor * (1e18 - liquidationFactor)
        uint storeFrontPriceFactor = Comet(cometAddress).storeFrontPriceFactor();
        uint256 discountFactor = mulFactor(storeFrontPriceFactor, FACTOR_SCALE - assetInfo.liquidationFactor);
        uint256 assetPriceDiscounted = mulFactor(assetPrice, FACTOR_SCALE - discountFactor);
        address baseTokenPriceFeed = Comet(cometAddress).baseTokenPriceFeed();
        uint256 basePrice = Comet(cometAddress).getPrice(baseTokenPriceFeed);
        // # of collateral assets
        // = (TotalValueOfBaseAmount / DiscountedPriceOfCollateralAsset) * assetScale
        // = ((basePrice * baseAmount / baseScale) / assetPriceDiscounted) * assetScale
        return basePrice * baseAmount * assetInfo.scale / assetPriceDiscounted / baseScale;
    }

    

    /**
     * check user balance if zero or not
     * @param account address of user
     * @param i asset number
     */
    function isInAsset(address account, uint8 i) internal view returns (bool) {
        // getting asset details
        CometStructs.AssetInfo memory assetInfo = Comet(cometAddress)
            .getAssetInfo(i);

        // getting balance
        uint amount = userCollateral[account][assetInfo.asset];

        return amount > 0 ? true : false;
    }

    /**
     * @dev Multiply a number by a factor
     */
    function mulFactor(uint n, uint factor) internal pure returns (uint) {
        return (n * factor) / FACTOR_SCALE;
    }

     /**
     * @dev Divide a common price quantity by a price, returning a `toScale` quantity
     */
    function divPrice(uint n, uint price, uint64 toScale) internal pure returns (uint) {
        return n * toScale / price;
    }

    /**
     * @dev Multiply a signed `fromScale` quantity by a price, returning a common price quantity
     */
    function signedMulPrice(
        int n,
        uint price,
        uint64 fromScale
    ) internal pure returns (int) {
        return (n * signed256(price)) / int256(uint256(fromScale));
    }

    /**
     * @dev Multiply a `fromScale` quantity by a price, returning a common price quantity
     */
    function mulPrice(
        uint n,
        uint price,
        uint64 fromScale
    ) internal pure returns (uint) {
        return (n * price) / fromScale;
    }

    /**
     * @dev The positive present supply balance if positive or the negative borrow balance if negative
     */
    function presentValue(
        int104 principalValue_
    ) internal view returns (int256) {
        Comet comet = Comet(cometAddress);
        uint64 si = comet.totalsBasic().baseSupplyIndex;
        uint64 bi = comet.totalsBasic().baseBorrowIndex;
        if (principalValue_ >= 0) {
            return signed256(presentValueSupply(si, uint104(principalValue_)));
        } else {
            return
                -signed256(presentValueBorrow(bi, uint104(-principalValue_)));
        }
    }

    /**
     * @dev The principal amount projected forward by the supply index
     */
    function presentValueSupply(
        uint64 baseSupplyIndex_,
        uint104 principalValue_
    ) internal view returns (uint256) {
        return (uint256(principalValue_) * baseSupplyIndex_) / baseIndexScale;
    }

    /**
     * @dev The principal amount projected forward by the borrow index
     */
    function presentValueBorrow(
        uint64 baseBorrowIndex_,
        uint104 principalValue_
    ) internal view returns (uint256) {
        return (uint256(principalValue_) * baseBorrowIndex_) / baseIndexScale;
    }

    /**
     * @dev The positive principal if positive or the negative principal if negative
     */
    function principalValue(
        int256 presentValue_
    ) internal view returns (int104) {
        Comet comet = Comet(cometAddress);
        uint64 si = comet.totalsBasic().baseSupplyIndex;
        uint64 bi = comet.totalsBasic().baseBorrowIndex;
        if (presentValue_ >= 0) {
            return signed104(principalValueSupply(si, uint256(presentValue_)));
        } else {
            return
                -signed104(principalValueBorrow(bi, uint256(-presentValue_)));
        }
    }

    /**
     * @dev The present value projected backward by the supply index (rounded down)
     *  Note: This will overflow (revert) at 2^104/1e18=~20 trillion principal for assets with 18 decimals.
     */
    function principalValueSupply(
        uint64 baseSupplyIndex_,
        uint256 presentValue_
    ) internal view returns (uint104) {
        return safe104((presentValue_ * baseIndexScale) / baseSupplyIndex_);
    }

    /**
     * @dev The present value projected backward by the borrow index (rounded up)
     *  Note: This will overflow (revert) at 2^104/1e18=~20 trillion principal for assets with 18 decimals.
     */
    function principalValueBorrow(
        uint64 baseBorrowIndex_,
        uint256 presentValue_
    ) internal view returns (uint104) {
        return
            safe104(
                (presentValue_ * baseIndexScale + baseBorrowIndex_ - 1) /
                    baseBorrowIndex_
            );
    }

    function doTransferIn(address asset, address user, uint amount) internal {
         // transfering to this contract
        ERC20(asset).transferFrom(user, address(this), amount);

        // approve
        ERC20(asset).approve(cometAddress, amount);

        // repaying
        Comet(cometAddress).supply(asset, amount);
    }
}
