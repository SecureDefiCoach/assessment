// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * SECURITY FIX: Secure Home Transaction Contract
 * 
 * VULNERABILITIES FIXED:
 * 1. Updated to latest Solidity version (0.8.19)
 * 2. Added ReentrancyGuard to prevent reentrancy attacks
 * 3. Replaced deprecated 'now' with block.timestamp
 * 4. Added SafeMath (built-in overflow protection in 0.8+)
 * 5. Improved access control with modifiers
 * 6. Added proper event logging
 * 7. Enhanced error handling with custom errors
 * 8. Added circuit breaker pattern
 * 9. Implemented proper state machine validation
 * 
 * ORIGINAL ISSUES:
 * - Reentrancy vulnerability in transfer functions
 * - Integer overflow/underflow risks
 * - Timestamp dependence
 * - Weak access control
 * - Missing event logging
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HomeTransaction is ReentrancyGuard, Pausable, Ownable {
    // SECURITY FIX: Use constants for better gas optimization and security
    uint256 public constant TIME_BETWEEN_DEPOSIT_AND_FINALIZATION = 5 minutes;
    uint256 public constant DEPOSIT_PERCENTAGE = 10;
    uint256 public constant MAX_REALTOR_FEE_PERCENTAGE = 10; // 10% max
    
    // SECURITY FIX: Custom errors for better gas efficiency
    error InvalidPrice();
    error InvalidRealtorFee();
    error UnauthorizedAccess();
    error InvalidContractState();
    error InvalidDepositAmount();
    error InsufficientPayment();
    error TransferFailed();
    error DeadlineExpired();
    error ContractPaused();

    enum ContractState {
        WaitingSellerSignature,
        WaitingBuyerSignature,
        WaitingRealtorReview,
        WaitingFinalization,
        Finalized,
        Rejected
    }
    
    enum ClosingConditionsReview { 
        Pending, 
        Accepted, 
        Rejected 
    }

    // State variables
    ContractState public contractState = ContractState.WaitingSellerSignature;
    ClosingConditionsReview public closingConditionsReview = ClosingConditionsReview.Pending;

    // Roles
    address payable public immutable realtor;
    address payable public immutable seller;
    address payable public immutable buyer;

    // Contract details
    string public homeAddress;
    string public zip;
    string public city;
    uint256 public immutable realtorFee;
    uint256 public immutable price;

    // Transaction details
    uint256 public deposit;
    uint256 public finalizeDeadline;
    
    // SECURITY FIX: Add emergency withdrawal capability
    bool public emergencyWithdrawalEnabled = false;

    // SECURITY FIX: Events for transparency and monitoring
    event ContractSigned(address indexed signer, ContractState newState);
    event DepositPaid(address indexed buyer, uint256 amount);
    event ClosingConditionsReviewed(address indexed realtor, bool accepted);
    event TransactionFinalized(address indexed buyer, uint256 totalAmount);
    event TransactionRejected(string reason);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);
    event ContractStateChanged(ContractState oldState, ContractState newState);

    // SECURITY FIX: Modifiers for access control
    modifier onlySeller() {
        if (msg.sender != seller) revert UnauthorizedAccess();
        _;
    }

    modifier onlyBuyer() {
        if (msg.sender != buyer) revert UnauthorizedAccess();
        _;
    }

    modifier onlyRealtor() {
        if (msg.sender != realtor) revert UnauthorizedAccess();
        _;
    }

    modifier onlyParticipant() {
        if (msg.sender != seller && msg.sender != buyer && msg.sender != realtor) {
            revert UnauthorizedAccess();
        }
        _;
    }

    modifier inState(ContractState _state) {
        if (contractState != _state) revert InvalidContractState();
        _;
    }

    modifier notPaused() {
        if (paused()) revert ContractPaused();
        _;
    }

    constructor(
        string memory _address,
        string memory _zip,
        string memory _city,
        uint256 _realtorFee,
        uint256 _price,
        address payable _realtor,
        address payable _seller,
        address payable _buyer
    ) {
        // SECURITY FIX: Enhanced input validation
        if (_price == 0) revert InvalidPrice();
        if (_realtorFee > _price) revert InvalidRealtorFee();
        if (_realtorFee > (_price * MAX_REALTOR_FEE_PERCENTAGE) / 100) revert InvalidRealtorFee();
        if (_realtor == address(0) || _seller == address(0) || _buyer == address(0)) {
            revert UnauthorizedAccess();
        }
        if (_seller == _buyer || _seller == _realtor || _buyer == _realtor) {
            revert UnauthorizedAccess();
        }

        realtor = _realtor;
        seller = _seller;
        buyer = _buyer;
        homeAddress = _address;
        zip = _zip;
        city = _city;
        price = _price;
        realtorFee = _realtorFee;

        emit ContractStateChanged(ContractState.WaitingSellerSignature, contractState);
    }

    /**
     * SECURITY FIX: Secure seller signature with proper validation
     */
    function sellerSignContract() 
        external 
        onlySeller 
        inState(ContractState.WaitingSellerSignature)
        notPaused
    {
        ContractState oldState = contractState;
        contractState = ContractState.WaitingBuyerSignature;
        
        emit ContractSigned(msg.sender, contractState);
        emit ContractStateChanged(oldState, contractState);
    }

    /**
     * SECURITY FIX: Secure buyer signature with reentrancy protection
     */
    function buyerSignContractAndPayDeposit() 
        external 
        payable 
        onlyBuyer 
        inState(ContractState.WaitingBuyerSignature)
        nonReentrant
        notPaused
    {
        uint256 minDeposit = (price * DEPOSIT_PERCENTAGE) / 100;
        if (msg.value < minDeposit || msg.value > price) {
            revert InvalidDepositAmount();
        }

        ContractState oldState = contractState;
        contractState = ContractState.WaitingRealtorReview;
        deposit = msg.value;
        
        // SECURITY FIX: Use block.timestamp instead of deprecated 'now'
        finalizeDeadline = block.timestamp + TIME_BETWEEN_DEPOSIT_AND_FINALIZATION;

        emit DepositPaid(msg.sender, msg.value);
        emit ContractSigned(msg.sender, contractState);
        emit ContractStateChanged(oldState, contractState);
    }

    /**
     * SECURITY FIX: Secure realtor review with reentrancy protection
     */
    function realtorReviewedClosingConditions(bool accepted) 
        external 
        onlyRealtor 
        inState(ContractState.WaitingRealtorReview)
        nonReentrant
        notPaused
    {
        ContractState oldState = contractState;
        
        if (accepted) {
            closingConditionsReview = ClosingConditionsReview.Accepted;
            contractState = ContractState.WaitingFinalization;
        } else {
            closingConditionsReview = ClosingConditionsReview.Rejected;
            contractState = ContractState.Rejected;

            // SECURITY FIX: Safe transfer with proper error handling
            _safeTransfer(buyer, deposit);
            emit TransactionRejected("Closing conditions rejected by realtor");
        }

        emit ClosingConditionsReviewed(msg.sender, accepted);
        emit ContractStateChanged(oldState, contractState);
    }

    /**
     * SECURITY FIX: Secure transaction finalization with reentrancy protection
     */
    function buyerFinalizeTransaction() 
        external 
        payable 
        onlyBuyer 
        inState(ContractState.WaitingFinalization)
        nonReentrant
        notPaused
    {
        uint256 remainingAmount = price - deposit;
        if (msg.value != remainingAmount) {
            revert InsufficientPayment();
        }

        ContractState oldState = contractState;
        contractState = ContractState.Finalized;

        uint256 sellerAmount = price - realtorFee;
        
        // SECURITY FIX: Safe transfers with proper error handling
        _safeTransfer(seller, sellerAmount);
        _safeTransfer(realtor, realtorFee);

        emit TransactionFinalized(msg.sender, price);
        emit ContractStateChanged(oldState, contractState);
    }

    /**
     * SECURITY FIX: Secure withdrawal with proper authorization and reentrancy protection
     */
    function withdrawFromTransaction() 
        external 
        inState(ContractState.WaitingFinalization)
        nonReentrant
        notPaused
    {
        // SECURITY FIX: Enhanced authorization logic
        bool canWithdraw = (msg.sender == buyer) || 
                          (block.timestamp >= finalizeDeadline) ||
                          (msg.sender == seller && block.timestamp >= finalizeDeadline) ||
                          (msg.sender == realtor && block.timestamp >= finalizeDeadline);
        
        if (!canWithdraw) {
            revert UnauthorizedAccess();
        }

        ContractState oldState = contractState;
        contractState = ContractState.Rejected;

        uint256 sellerAmount = deposit - realtorFee;
        
        // SECURITY FIX: Safe transfers with proper error handling
        _safeTransfer(seller, sellerAmount);
        _safeTransfer(realtor, realtorFee);

        emit TransactionRejected("Transaction withdrawn");
        emit ContractStateChanged(oldState, contractState);
    }

    /**
     * SECURITY FIX: Emergency withdrawal function (only owner)
     */
    function emergencyWithdraw() 
        external 
        onlyOwner 
        nonReentrant 
    {
        if (!emergencyWithdrawalEnabled) {
            revert UnauthorizedAccess();
        }

        uint256 balance = address(this).balance;
        if (balance > 0) {
            _safeTransfer(payable(owner()), balance);
            emit EmergencyWithdrawal(owner(), balance);
        }
    }

    /**
     * SECURITY FIX: Enable emergency withdrawal (only owner)
     */
    function enableEmergencyWithdrawal() external onlyOwner {
        emergencyWithdrawalEnabled = true;
    }

    /**
     * SECURITY FIX: Pause contract functionality (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * SECURITY FIX: Unpause contract functionality (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * SECURITY FIX: Safe transfer function with proper error handling
     */
    function _safeTransfer(address payable recipient, uint256 amount) private {
        if (amount == 0) return;
        
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * SECURITY FIX: View functions for contract state
     */
    function getContractDetails() external view returns (
        string memory _homeAddress,
        string memory _zip,
        string memory _city,
        uint256 _price,
        uint256 _realtorFee,
        ContractState _state,
        uint256 _deposit,
        uint256 _deadline
    ) {
        return (
            homeAddress,
            zip,
            city,
            price,
            realtorFee,
            contractState,
            deposit,
            finalizeDeadline
        );
    }

    function getParticipants() external view returns (
        address _seller,
        address _buyer,
        address _realtor
    ) {
        return (seller, buyer, realtor);
    }

    function isDeadlinePassed() external view returns (bool) {
        return block.timestamp >= finalizeDeadline;
    }

    /**
     * SECURITY FIX: Prevent accidental ETH sends
     */
    receive() external payable {
        revert("Direct payments not allowed");
    }

    fallback() external payable {
        revert("Function not found");
    }
}