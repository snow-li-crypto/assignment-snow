// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChequeBank {
    /**
     *   address balance.
     *
     *  amount unit: Wei
     *  e.g {"0x5B38Da6a701c568545dCfcB03FcB875f56beddC4": 1000000000000000000}
     */
    mapping(address => uint) accounts;

    /**
        redeemFlag: Mark true if it has been redeemed
        revokeFlag: Mark true if it has been revoked
        signOverFlag: Mark true if it has been sign over
     */
    mapping(bytes32 => ECheque) eCheques;

    struct ECheque {
        bool revokeFlag;
        bool redeemFlag;
        bool signOverFlag;
        SignOverInfo signOverInfo;
        address redeemAddress;
    }

    struct ChequeInfo {
        uint amount;
        bytes32 chequeId;
        uint32 validFrom;
        uint32 validThru;
        address payee;
        address payer;
    }
    struct SignOverInfo {
        uint8 counter;
        bytes32 chequeId;
        address oldPayee;
        address newPayee;
    }

    struct Cheque {
        ChequeInfo chequeInfo;
        bytes sig;
    }
    struct SignOver {
        SignOverInfo signOverInfo;
        bytes sig;
    }

    event Withdraw(address, uint);
    event Redeem(address, uint);

    //------------------------------------------------
    function deposit() external payable {
        if (msg.value > 0) accounts[msg.sender] += msg.value;
    }

    function withdraw(uint amount) external {
        transfer(msg.sender, msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function withdrawTo(uint amount, address payable recipient) external {
        transfer(msg.sender, recipient, amount);
        emit Withdraw(msg.sender, amount);
    }

    //------------------------------------------------

    //------------------------------------------------

    /**
        redeem e-Cheque
     */
    function redeem(Cheque memory chequeData) external payable {
        bytes32 chequeId = chequeData.chequeInfo.chequeId;

        require(
            msg.sender == chequeData.chequeInfo.payee,
            "The payee and the contract caller are inconsistent"
        );
        require(
            eCheques[chequeId].signOverInfo.counter == 0,
            "The e-check has been signed over"
        );

        chequeCheck(chequeData);

        // excute redeem
        doRedeem(
            chequeId,
            chequeData.chequeInfo.payer,
            chequeData.chequeInfo.payee,
            chequeData.chequeInfo.amount
        );
    }

    /**
        Notify the e-Cheque has been signed over
     */
    function notifySignOver(SignOver memory signOver) external {
        SignOverInfo memory info = signOver.signOverInfo;

        require(!eCheques[info.chequeId].revokeFlag, "e-cheque has revoke");

        uint8 existCounter = eCheques[info.chequeId].signOverInfo.counter;
        if (existCounter > 0)
            require(
                info.oldPayee == eCheques[info.chequeId].signOverInfo.newPayee
            );

        require(
            existCounter + 1 == info.counter,
            "The step size of counter is 1"
        );

        require(
            recoverSignerBySignOver(signOver) == info.oldPayee,
            "signOver sig invalid"
        );

        eCheques[info.chequeId].signOverInfo = info;
    }

    /**
        
     */
    function redeemSignOver(
        Cheque memory chequeData,
        SignOver[] memory signOverData
    ) external {
        ChequeInfo memory chequeInfo = chequeData.chequeInfo;
        address payee = signOverData.length == 0
            ? chequeInfo.payee
            : signOverData[signOverData.length - 1].signOverInfo.newPayee;

        //redeem check
        require(isChequeValid(payee, chequeData, signOverData));

        // excute redeem
        doRedeem(
            chequeData.chequeInfo.chequeId,
            chequeData.chequeInfo.payer,
            payee,
            chequeData.chequeInfo.amount
        );
    }

    function isChequeValid(
        address payee,
        Cheque memory chequeData,
        SignOver[] memory signOverData
    ) public view returns (bool) {
        uint signOverLength = signOverData.length;
        require(signOverLength <= 6, "up to 6 times");

        //exist signing over
        if (signOverData.length > 0) {
            require(
                payee == signOverData[signOverLength - 1].signOverInfo.newPayee,
                "payee invalid"
            );
        } else {
            // does not exist signing over
            require(payee == chequeData.chequeInfo.payee, "payee invalid");
        }

        chequeCheck(chequeData);

        for (uint i = 0; i < signOverLength; i++) {
            SignOver memory signOver = signOverData[i];
            require(
                signOver.signOverInfo.counter == i + 1,
                "The value of Counter should be 1 to 6"
            );
            require(
                recoverSignerBySignOver(signOver) ==
                    signOver.signOverInfo.oldPayee,
                "signOver sig invalid"
            );

            /***
                sign over must be coherent
                e.g(A, B , C, D are all addresses)
                A sign over to B
                B sign over to C
                C sign over to D
             */
            if (i == 0) {
                require(
                    signOver.signOverInfo.oldPayee ==
                        chequeData.chequeInfo.payee
                );
            } else {
                require(
                    signOver.signOverInfo.oldPayee ==
                        signOverData[i - 1].signOverInfo.newPayee
                );
            }
        }

        return true;
    }

    function chequeCheck(Cheque memory cheque) internal view {
        ChequeInfo memory info = cheque.chequeInfo;
        require(block.number >= info.validFrom, "validFrom > block.number");
        if (info.validThru != 0)
            require(block.number < info.validThru, "block.number <= validThru");
        require(!eCheques[info.chequeId].redeemFlag, "Repeat Redeeming");
        require(
            !eCheques[info.chequeId].revokeFlag,
            "The e-Cheque has been revoke"
        );

        //check cheque signer
        require(
            recoverSignerByCheque(cheque) == cheque.chequeInfo.payer,
            "sign failed"
        );
    }

    function doRedeem(
        bytes32 chequeId,
        address payer,
        address payee,
        uint amount
    ) internal {
        //excute redeem
        transfer(payer, payee, amount);

        eCheques[chequeId].redeemAddress = payee;
        eCheques[chequeId].redeemFlag = true;
        emit Redeem(payee, amount);
    }

    /**
     *    Transfer amount from payer to payee
     */
    function transfer(
        address payer,
        address payee,
        uint amount
    ) internal {
        require(accounts[payer] >= amount, "Insufficient balance");
        payable(payee).transfer(amount);
        accounts[payer] -= amount;
    }

    function revoke(bytes32 chequeId) external {
        if (eCheques[chequeId].redeemAddress != msg.sender)
            require(!eCheques[chequeId].redeemFlag, "e-cheque has redeem");

        if (!eCheques[chequeId].revokeFlag)
            eCheques[chequeId].revokeFlag = true;
    }

    /**
     *  recover signer  by SignOver
     */
    function recoverSignerBySignOver(SignOver memory signOver)
        internal
        pure
        returns (address)
    {
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(
                    bytes4(0xFFFFDEAD),
                    signOver.signOverInfo.counter,
                    signOver.signOverInfo.chequeId,
                    signOver.signOverInfo.oldPayee,
                    signOver.signOverInfo.newPayee
                )
            )
        );
        return recoverSigner(message, signOver.sig);
    }

    /**
     *    recover signer  by Cheque
     */
    function recoverSignerByCheque(Cheque memory cheque)
        internal
        view
        returns (address)
    {
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(
                    cheque.chequeInfo.chequeId,
                    cheque.chequeInfo.payer,
                    cheque.chequeInfo.payee,
                    cheque.chequeInfo.amount,
                    cheque.chequeInfo.validFrom,
                    cheque.chequeInfo.validThru,
                    address(this)
                )
            )
        );
        return recoverSigner(message, cheque.sig);
    }

    /// split signature and returns v r s
    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        require(sig.length == 65);

        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        public
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}
