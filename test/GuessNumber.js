const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("GuessNumber", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployFixture(nonceHash, nonceNumHash, capacity) {

    const GuessNumber = await ethers.getContractFactory("GuessNumber");
    const guessNumber = await GuessNumber.deploy(nonceHash,  nonceNumHash, capacity, { value: ethers.utils.parseEther("1.0") });
    return guessNumber;
  }

  describe("Cases", function () {

    it("case1", async function () {

      const [owner, addr1, addr2] = await ethers.getSigners();

      const nonceHash = "0x1a5d6cb6ecd5059e65b5a6e8117beede444b8b1152787f00a4d98dca32f02fd4";
      const nonceNumHash = "0x00bdc317b5cfcb50e7b37b5ba762d1f1bae4991413238469db3963c8d84c2081";
      //nonce = HELLO, number=999
      const guessNumber = await deployFixture(nonceHash, nonceNumHash, 2);

      balanceLog(addr1);
      balanceLog(addr2);

      
      const options = {value: ethers.utils.parseEther("1.0"),  gasPrice: 8000000000};
      //Player 1 
      /**
       * number = 800
       * deposit = 1 Ether 
       * */
       const addr1Contract = bulidContract(guessNumber.address, addr1);
       await addr1Contract.guess(800, options);

      //Player 2
      /**
       * number = 900
       * deposit = 1 Ether 
       * */ 
       const addr2Contract = bulidContract(guessNumber.address, addr2);
       await addr2Contract.guess(900, options);

       
       await guessNumber.reveal("HELLO", 999);

       balanceLog(addr1);
       balanceLog(addr2);
       /**
        * all address default ETH is 10000
        * 
        * expected Player2 is the winner
        * 
        * payer1 eth : 9998.999...
        * payer2 eth : 10001.999...
        * 
        */
        expect( Math.ceil(await getEthBalance(addr2) )).to.gte(10002);
    });


    it("case2", async function () {

      const [owner, addr1, addr2, addr3] = await ethers.getSigners();

      const nonceHash = "0x1a5d6cb6ecd5059e65b5a6e8117beede444b8b1152787f00a4d98dca32f02fd4";
      const nonceNumHash = "0x00bdc317b5cfcb50e7b37b5ba762d1f1bae4991413238469db3963c8d84c2081";
      //nonce = HELLO, number=999
      const guessNumber = await deployFixture(nonceHash, nonceNumHash, 2);

      balanceLog(addr3);

      //Player 1 
      /**
       * number = 800
       * deposit = 1 Ether 
       * */
       const addr1Contract = bulidContract(guessNumber.address, addr3);
       await addr1Contract.guess(800, {value: ethers.utils.parseEther("2.0"),  gasPrice: 8000000000}).catch(err => console.log(err))

       balanceLog(addr3);
       /**
        * all address default ETH is 10000
        * 
        * expected Player guess fail! 
        * 
        * so addr3 balance there won't be any reduction
        */
        expect( Math.ceil(await getEthBalance(addr3) )).to.eq(10000);
    });


    it("case3", async function () {

      const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

      const nonceHash = "0x1a5d6cb6ecd5059e65b5a6e8117beede444b8b1152787f00a4d98dca32f02fd4";
      const nonceNumHash = "0x2c42c38e09be8f0db674b20bd805fa3f4f5dcaddbfe527d2a5a86c78ae3ab1b7";
      //nonce = HELLO, number=500
      const guessNumber = await deployFixture(nonceHash, nonceNumHash, 2);

      balanceLog(addr4);
      balanceLog(addr5);

      
      const options = {value: ethers.utils.parseEther("1.0"),  gasPrice: 8000000000};
      //Player 1 
      /**
       * number = 450
       * deposit = 1 Ether 
       * */
       const addr4Contract = bulidContract(guessNumber.address, addr4);
       await addr4Contract.guess(450, options);

      //Player 2
      /**
       * number = 550
       * deposit = 1 Ether 
       * */ 
       const addr5Contract = bulidContract(guessNumber.address, addr5);
       await addr5Contract.guess(550, options);

       
       await guessNumber.reveal("HELLO", 500);

       balanceLog(addr4);
       balanceLog(addr5);
       /**
        * all address default ETH is 10000
        * 
        * expected Player1 and Player2 both are winners
        * 
        * payer1 eth : 10000.4994...
        * payer2 eth : 10000.4994...
        * 
        */
        expect( Math.ceil(await getEthBalance(addr4) )).to.eq( Math.ceil(await getEthBalance(addr5) ) );
    });



    async function balanceLog(addr){
      const balance = await addr.getBalance();
      console.log(ethers.utils.formatEther(balance.toString())); 
    }

    async function getEthBalance(addr){
      const balance = await addr.getBalance();
      return ethers.utils.formatEther(balance.toString()); 
    }

    function bulidContract(contractAddress, provider){
      let abi = [
          "function guess(uint16 number_) external payable "
      ];
      // 使用Provider 连接合约，将只有对合约的可读权限
      let contract = new ethers.Contract(contractAddress, abi, provider);
      return contract;
    }



  });

});
