// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Strings.sol";

contract GuessNumber {
    struct Ticket {
        uint16 number;
        bool submited;
        address addr;
    }

    //----------------------------------

    address host;

    bytes32 nonceHash;

    bytes32 nonceNumHash;

    uint depositValue;

    uint16 capacity;

    Ticket[] tickets;

    Ticket[] winners;

    enum State {
        Created,
        Guessing,
        Canceled
    }

    State state;

    //----------------------------------

    event Received(address, uint);
    event Fallback(address);

    //----------------------------------
    error NumberRange();
    error RepeatSubmit();
    error ExistNumber();
    error AlreadyCanceled();
    error FailState();
    error FailSign();
    error FailDepositValue();
    error PlayersLimit();

    //----------------------------------

    modifier numberVerify(uint number) {
        if (number < 0 || number >= 1000) {
            revert NumberRange();
        }
        _;
    }

    modifier stateVerify() {
        if (state == State.Canceled) {
            revert FailState();
        }
        _;
    }

    modifier valueVerify() {
        if (msg.value == 0) {
            revert FailDepositValue();
        }
        _;
    }

    //----------------------------------

    constructor(
        bytes32 nonceHash_,
        bytes32 nonceNumHash_,
        uint16 capacity_
    ) payable valueVerify {
        require(capacity_ > 1 && capacity_ <= 1001);
        nonceHash = nonceHash_;
        nonceNumHash = nonceNumHash_;
        capacity = capacity_;
        state = State.Created;
        depositValue = msg.value;
        host = msg.sender;
    }

    function guess(uint16 number_)
        external
        payable
        numberVerify(number_)
        stateVerify
        valueVerify
    {
        require(host != msg.sender, "host not allow guess!");

        if (tickets.length == capacity) revert PlayersLimit();

        if (msg.value != depositValue) revert FailDepositValue();

        for (uint i = 0; i < tickets.length; i++) {
            if (tickets[i].addr == msg.sender) revert RepeatSubmit();
            if (tickets[i].number == number_) revert ExistNumber();
        }

        tickets.push(
            Ticket({number: number_, addr: msg.sender, submited: true})
        );

        if(state == State.Created)
           state = State.Guessing;
    }

    function reveal(string memory nonce, uint16 number_)
        external
        stateVerify
        numberVerify(number_)
    {
        require(host == msg.sender, "only allow host to execute!");
        require(tickets.length == capacity, "not enough player!");
        require(
            keccak256(abi.encodePacked(nonce)) == nonceHash,
            "nonce faild!"
        );
        require(
            keccak256(abi.encodePacked(nonce, Strings.toString(number_))) ==
                nonceNumHash,
            "number faild!"
        );
        require(tickets.length >= 2, "At least 2 players required!");

        // total reward
        uint sumAward = depositValue + tickets.length * depositValue;

        uint16 flag = 1000;
        for (uint i = 0; i < tickets.length; i++) {
            uint16 temp = tickets[i].number >= number_
                ? tickets[i].number - number_
                : number_ - tickets[i].number;
            if (temp < flag) flag = temp;
        }

        for (uint i = 0; i < tickets.length; i++) {
            uint16 temp = tickets[i].number >= number_
                ? tickets[i].number - number_
                : number_ - tickets[i].number;
            if (temp == flag) winners.push(tickets[i]);
        }

        uint avgAward = sumAward / winners.length;
        for (uint i = 0; i < winners.length; i++) {
            payable(winners[i].addr).transfer(avgAward);
        }
        state = State.Canceled;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Fallback(msg.sender);
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}
