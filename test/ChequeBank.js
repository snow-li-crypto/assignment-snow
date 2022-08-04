const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("ChequeBank", function () {

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployFixture(addr) {

    const ChequeBank = await ethers.getContractFactory("ChequeBank");
    // ChequeBank.connect(addr);
    // ChequeBank.attach(addr);
    const chequeBank = await ChequeBank.deploy();
    return chequeBank;

  }



  describe("e-cheque", function () {

    it("deposit and withdraw", async function () {
      const [owner, addr1] = await ethers.getSigners();
      const chequeBank = await deployFixture(owner);
      chequeBank.attach(owner);

      const options = { value: ethers.utils.parseEther("100") };
      chequeBank.deposit(options);

      expect(await getBalanceInt(chequeBank)).to.eq(100);

      chequeBank.withdraw(ethers.utils.parseEther("50"));
      expect(await getBalanceInt(chequeBank)).to.eq(50);

      const addr1BeforeBalance = await getBalanceInt(addr1);

      chequeBank.withdrawTo(ethers.utils.parseEther("50"), addr1.address);
      expect(await getBalanceInt(chequeBank)).to.eq(0);

      const addr1AfterBalance = await getBalanceInt(addr1);
      expect(addr1AfterBalance - addr1BeforeBalance).to.eq(50);

    });

    it("redeem", async function () {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const amount = ethers.utils.parseEther("100");
      const chequeId = generateChequeId(owner);
      const obj = {
        chequeId: chequeId,
        amount: amount,
        validFrom: 70,
        validThru: 0,
        payer: owner.address,
        payee: addr2.address
      };

      const chequeBank = await deployFixture(owner);
      const cheque = await generateCheque(chequeBank, owner, obj);

      // console.log(await owner.provider.getBlockNumber());

      try {
        await chequeBank.redeem(cheque);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('The payee and the contract caller are inconsistent');
      }

      const chequeBank_addr2 = await chequeBank.connect(addr2);
      try {
        obj.validFrom = await owner.provider.getBlockNumber() + 2;
        const cheque2 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque2);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('validFrom > block.number');
      }

      try {
        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom;
        const cheque3 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque3);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('block.number <= validThru');
      }

      try {
        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom + 2;
        const cheque4 = await generateCheque(chequeBank, owner, obj);

        cheque4.chequeInfo.validFrom = obj.validFrom - 1;
        await chequeBank_addr2.redeem(cheque4);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('sign failed');
      }

      try {
        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom + 2;
        const cheque5 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque5);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('Insufficient balance');
      }


      try {

        const addr2_balance_befor = await getBalanceInt(addr2);
        // console.log(await getBalanceInt(addr2));

        await chequeBank.deposit({ value: amount });

        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom + 2;
        const cheque6 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque6);

        const addr2_after_befor = await getBalanceInt(addr2);

        expect(addr2_after_befor - addr2_balance_befor).to.eq(100);

      } catch (error) {
        expect(true).to.eq(false);
      }

      try {
        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom + 2;
        const cheque7 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque7);
      } catch (error) {
        expect(error.message).to.include('Repeat Redeeming');
      }

      try {
        const chequeId2 = generateChequeId(owner);
        const signOverInfo = {
          magicNumber: "0xFFFFDEAD",
          counter: 1,
          chequeId: chequeId2,
          oldPayee: owner.address,
          newPayee: addr1.address
        };
        const signOver = await generateSignOver(owner, signOverInfo);
        await chequeBank.notifySignOver(signOver);

        obj.validFrom = await owner.provider.getBlockNumber();
        obj.validThru = obj.validFrom + 2;
        obj.chequeId = chequeId2;
        const cheque8 = await generateCheque(chequeBank, owner, obj);
        await chequeBank_addr2.redeem(cheque8);
      } catch (error) {
        expect(error.message).to.include('The e-check has been signed over');
      }

    });


    it("revoke", async function () {
      const [owner, addr1, addr2] = await ethers.getSigners();

      const amount = ethers.utils.parseEther("100");
      const chequeId = generateChequeId(owner);
      let validFrom = await owner.provider.getBlockNumber();
      const obj2 = {
        chequeId: chequeId,
        amount: amount,
        validFrom: validFrom,
        validThru: validFrom + 4,
        payer: owner.address,
        payee: addr2.address
      };

      const chequeBank = await deployFixture(owner);
      const cheque = await generateCheque(chequeBank, owner, obj2);

      await chequeBank.revoke(chequeId);
      try {
        const chequeBank_addr2 = await chequeBank.connect(addr2);
        await chequeBank_addr2.redeem(cheque);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('The e-Cheque has been revoke');
      }
    });

    it("notifySignOver", async function () {
      const [owner, addr1, addr2, addr3] = await ethers.getSigners();

      const amount = ethers.utils.parseEther("100");
      const chequeId = generateChequeId(owner);
      let validFrom = await owner.provider.getBlockNumber();
      const signOverInfo = {
        magicNumber: "0xFFFFDEAD",
        counter: 2,
        chequeId: chequeId,
        oldPayee: owner.address,
        newPayee: addr3.address
      };

      const chequeBank = await deployFixture(owner);
      const signOver = await generateSignOver(owner, signOverInfo);

      try {
        await chequeBank.notifySignOver(signOver);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('The step size of counter is 1');
      }

      try {
        const signOver2 = await generateSignOver(owner, signOverInfo);
        signOver2.signOverInfo.counter = 1;
        await chequeBank.notifySignOver(signOver2);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.message).to.include('signOver sig invalid');
      }

      try {
        signOverInfo.counter = 1
        const signOver3 = await generateSignOver(owner, signOverInfo);
        await chequeBank.notifySignOver(signOver3);
        // expect(true).to.eq(false);
      } catch (error) {
        // console.log(error.message);
        expect(true).to.eq(false);
      }


    });

    it("isChequeValid", async function () {
      const [owner, addr1, addr2, addr3] = await ethers.getSigners();

      const amount = ethers.utils.parseEther("100");
      const chequeId = generateChequeId(owner);
      // let validFrom = await owner.provider.getBlockNumber();
      const obj = {
        chequeId: chequeId,
        amount: amount,
        validFrom: 0,
        validThru: 0,
        payer: owner.address,
        payee: addr1.address
      };

      const chequeBank = await deployFixture(owner);
      const cheque = await generateCheque(chequeBank, owner, obj);

      const signOvers = [];
      let signOverInfo1 = createSignOverInfo(1 ,chequeId, addr1.address, addr2.address);
      let signOver1 = await generateSignOver(addr1, signOverInfo1);
      signOvers.push(signOver1);

      let signOverInfo2 = createSignOverInfo(2 ,chequeId, addr2.address, addr3.address);
      let signOver2 = await generateSignOver(addr2, signOverInfo2);
      signOvers.push(signOver2);

      await chequeBank.isChequeValid(addr3.address, cheque, signOvers);

      try {
        await chequeBank.isChequeValid(addr2.address, cheque, signOvers);
      } catch (error) {
        expect(error.message).to.include('payee invalid');
      }

    });

    it("redeemSignOver", async function () {
      const [owner, addr1, addr2, addr3] = await ethers.getSigners();

      const amount = ethers.utils.parseEther("100");
      const chequeId = generateChequeId(owner);
      const obj = {
        chequeId: chequeId,
        amount: amount,
        validFrom: 0,
        validThru: 0,
        payer: owner.address,
        payee: addr1.address
      };

      const chequeBank = await deployFixture(owner);
      const cheque = await generateCheque(chequeBank, owner, obj);

      const signOvers = [];
      let signOverInfo1 = createSignOverInfo(1 ,chequeId, addr1.address, addr2.address);
      let signOver1 = await generateSignOver(addr1, signOverInfo1);
      signOvers.push(signOver1);

      let signOverInfo2 = createSignOverInfo(2 ,chequeId, addr2.address, addr3.address);
      let signOver2 = await generateSignOver(addr2, signOverInfo2);
      signOvers.push(signOver2);

      await chequeBank.isChequeValid(addr3.address, cheque, signOvers);

      const addr3_balance_befor = await getBalanceInt(addr3);

      await chequeBank.deposit({value: amount});
      await chequeBank.redeemSignOver(cheque, signOvers);

      const addr3_balance_after = await getBalanceInt(addr3);
      expect(addr3_balance_after - addr3_balance_befor).to.eq(100);

    });

    function createSignOverInfo(counter, chequeId, oldPayee, newPayee){
      const signOverInfo = {
        magicNumber: "0xFFFFDEAD",
        counter: counter,
        chequeId: chequeId,
        oldPayee: oldPayee,
        newPayee: newPayee
      };
      return signOverInfo;
    }

    async function getBalanceInt(addr) {
      const balance = await addr.getBalance();
      return parseInt(ethers.utils.formatEther(balance.toString()));
    }

    async function generateCheque(chequeBank, signer, obj) {


      const contractAddress = chequeBank.address;

      const datas = [obj.chequeId, obj.payer, obj.payee, obj.amount, obj.validFrom, obj.validThru, contractAddress];
      const types = ["bytes32", "bytes", "bytes", "uint", "uint32", "uint32", "bytes"];
      const hash = ethers.utils.solidityKeccak256(types, datas);
      const solidityhash = ethers.utils.solidityKeccak256(
        ['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const arrayifyData = ethers.utils.arrayify(hash);
      const sign = await signer.signMessage(arrayifyData);

      // console.log(solidityhash);
      // console.log(sign);
      return { chequeInfo: obj, sig: sign };
    }

    async function generateSignOver(signer, obj) {

      const datas = ["0xFFFFDEAD", obj.counter, obj.chequeId, obj.oldPayee, obj.newPayee];
      const types = ["bytes4", "uint8", "bytes32", "bytes", "bytes"];
      const hash = ethers.utils.solidityKeccak256(types, datas);
      const solidityhash = ethers.utils.solidityKeccak256(
        ['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])

      const arrayifyData = ethers.utils.arrayify(hash);
      const sign = await signer.signMessage(arrayifyData);

      // console.log(solidityhash);
      // console.log(sign);
      return { signOverInfo: obj, sig: sign };
    }

    function generateChequeId(payer) {
      let time = new Date().getTime();
      const x = Math.ceil(Math.random() * 10000);
      const chequeId = ethers.utils.soliditySha256(["uint", "string", "uint"], [time, payer, x])
      return chequeId;
    }

  });

});
