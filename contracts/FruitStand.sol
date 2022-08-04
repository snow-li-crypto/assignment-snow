// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WATER is ERC20 {
    constructor(uint256 initialSupply) ERC20("WaterToken", "WATER") {
        _mint(msg.sender, initialSupply);
    }
}

contract MELON is ERC20 {
    constructor(uint256 initialSupply) ERC20("MelonToken", "MELON") {
        _mint(msg.sender, initialSupply);
    }
}

contract FruitStand {

    struct UserStake {
        uint startBlock;
        uint stakeAmount;
    }

    ERC20 water;
    ERC20 melon;
    mapping (address => UserStake) userStakes;

    constructor(address _water, address _melon) {
        water = ERC20(_water);
        melon = ERC20(_melon);
    }

    function stake(uint _amount, uint16 blockNumber) external {
        require(_amount > 0, "FruitStand: Stake amount must be greater than zero");
        if (userStakes[msg.sender].startBlock != 0) {
            // Pay out current stake
            payout(msg.sender, userStakes[msg.sender]);
        }
        water.transferFrom(msg.sender, address(this), _amount);
        UserStake memory newStake = UserStake({ startBlock: blockNumber, stakeAmount: _amount });
        userStakes[msg.sender] = newStake; 
    }

    function unstake() external {
        require(userStakes[msg.sender].startBlock != 0, "FruitStand: User have not staked");
        payout(msg.sender, userStakes[msg.sender]);
        water.transfer(msg.sender, userStakes[msg.sender].stakeAmount);
        userStakes[msg.sender] = UserStake({ startBlock: 0, stakeAmount: 0 }); 
    }

    function payout(address user, UserStake memory stake) internal returns (uint8 errCode) {
        // uint blockDelta = block.number - stake.startBlock;
        uint blockDelta = 300 - stake.startBlock;
        if (blockDelta > 300) {
            blockDelta = 300;
        }
        uint multiplier = fibV2(blockDelta); 
        uint rewardAmount = multiplier * stake.stakeAmount;
        melon.transfer(user, rewardAmount);
        return 0;
    }

    // function fib(uint n) public view returns (uint fn) {
    //     if (n == 0) {
    //         return 0;
    //     }
    //     else if (n == 1) {
    //         return 1;
    //     }
    //     else if (n > 1) {
    //         return fib(n-2) + fib(n-1);
    //     }
    // }

    function fibV2(uint n) public view returns (uint fn) {
        
        uint16 num1 = 1;
        uint16 num2 = 1;
        uint16 tmp = 0;
        uint16 i = 0;
        if (n < 3){
            return 1;
        }else{
            for (i = 0; i <= n-3; i++){
                tmp = num1 + num2;
                num1 = num2;
                num2 = tmp;
            }
            return tmp;
        }

    }

}
