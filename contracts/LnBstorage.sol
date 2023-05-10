// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.11;

library CometStructs {
    struct AssetInfo {
        uint8 offset;
        address asset;
        address priceFeed;
        uint64 scale;
        uint64 borrowCollateralFactor;
        uint64 liquidateCollateralFactor;
        uint64 liquidationFactor;
        uint128 supplyCap;
    }

    struct UserBasic {
        int104 principal;
        uint64 baseTrackingIndex;
        uint64 baseTrackingAccrued;
        uint16 assetsIn;
        uint8 _reserved;
    }

    struct TotalsBasic {
        uint64 baseSupplyIndex;
        uint64 baseBorrowIndex;
        uint64 trackingSupplyIndex;
        uint64 trackingBorrowIndex;
        uint104 totalSupplyBase;
        uint104 totalBorrowBase;
        uint40 lastAccrualTime;
        uint8 pauseFlags;
    }

    struct UserCollateral {
        uint128 balance;
        uint128 _reserved;
    }

    struct RewardOwed {
        address token;
        uint owed;
    }

    struct TotalsCollateral {
        uint128 totalSupplyAsset;
        uint128 _reserved;
    }

     struct LiquidatorPoints {
        uint32 numAbsorbs;
        uint64 numAbsorbed;
        uint128 approxSpend;
        uint32 _reserved;
    }
}

interface Comet {
    function baseScale() external view returns (uint);

    function supply(address asset, uint amount) external;

    function supplyFrom(
        address from,
        address dst,
        address asset,
        uint amount
    ) external;

    function supplyTo(address dst, address asset, uint amount) external;

    function withdraw(address asset, uint amount) external;

    function withdrawFrom(
        address src,
        address to,
        address asset,
        uint amount
    ) external;

    function withdrawTo(address to, address asset, uint amount) external;

    function balanceOf(address account) external view returns (uint256);

    function getSupplyRate(uint utilization) external view returns (uint);

    function getBorrowRate(uint utilization) external view returns (uint);

    function getAssetInfoByAddress(
        address asset
    ) external view returns (CometStructs.AssetInfo memory);

    function getAssetInfo(
        uint8 i
    ) external view returns (CometStructs.AssetInfo memory);

    function getPrice(address priceFeed) external view returns (uint128);

    function userBasic(
        address
    ) external view returns (CometStructs.UserBasic memory);

    function totalsBasic()
        external
        view
        returns (CometStructs.TotalsBasic memory);

    function userCollateral(
        address,
        address
    ) external view returns (CometStructs.UserCollateral memory);

    function baseTokenPriceFeed() external view returns (address);

    function storeFrontPriceFactor() external view returns (uint);

    function numAssets() external view returns (uint8);

    function getUtilization() external view returns (uint);

    function baseTrackingSupplySpeed() external view returns (uint);

    function baseTrackingBorrowSpeed() external view returns (uint);

    function totalSupply() external view returns (uint256);

    function totalBorrow() external view returns (uint256);

    function baseBorrowMin() external view returns (uint256);

    function decimals() external view returns (uint8);

    function baseIndexScale() external pure returns (uint64);

    function totalsCollateral(
        address asset
    ) external view returns (CometStructs.TotalsCollateral memory);

    function baseMinForRewards() external view returns (uint256);

    function baseToken() external view returns (address);

    function quoteCollateral(
        address asset,
        uint baseAmount
    ) external view returns (uint);

}

interface CometRewards {
    function getRewardOwed(
        address comet,
        address account
    ) external returns (CometStructs.RewardOwed memory);

    function claim(address comet, address src, bool shouldAccrue) external;
}

interface ERC20 {
    function approve(address spender, uint256 amount) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function decimals() external view returns (uint);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address user) external returns (uint);
}

abstract contract LnBstorage {
    event SupplyBase(address indexed user, uint amount);
    event SupplyCollateral(
        address indexed user,
        address indexed asset,
        uint amount
    );
    event WithdrawBase(address indexed user, uint amount);
    event WithdrawCollateral(
        address indexed user,
        address indexed asset,
        uint amount
    );

    /// @notice Event emitted when a user's collateral is absorbed by the protocol
    event AbsorbCollateral(address indexed absorber, address indexed borrower, address indexed asset, uint collateralAbsorbed, uint usdValue);

    /// @notice Event emitted when a borrow position is absorbed by the protocol
    event AbsorbDebt(address indexed absorber, address indexed borrower, uint basePaidOut, uint usdValue);

    /// @notice Event emitted when a collateral asset is purchased from the protocol
    event BuyCollateral(address indexed buyer, address indexed asset, uint baseAmount, uint collateralAmount);

    event Transfer(address indexed from, address indexed to, uint amount);


    address cometAddress; // main comet contract address
    uint baseIndexScale;
    uint baseScale;
    uint public baseBorrowMin;
    address public baseToken;
    uint8 public numAssets;
    uint16 public targetBaseReserve;
    uint16 public targetCollateralReserve;
    uint64 internal constant FACTOR_SCALE = 1e18;

    uint64 collateralAssetBorrowDecrease;

    string public constant version = "0.3";

    struct userBasics {
        int104 principal;
        int104 liquidatedLeftOver;
        // bool isAbsorb;
    }

    mapping(address => userBasics) public userBasic;

    //  user -> token -> assetinfo
    mapping(address => mapping(address => uint128)) public userCollateral;

    mapping(address => uint128) public getCollateralReserves;
    // mapping(address => int104) public liquidatedAccountInterestLeft;

    /// @notice Mapping of magic liquidator points, currently not in used maybe used in future
    mapping(address => CometStructs.LiquidatorPoints) public liquidatorPoints;
}
