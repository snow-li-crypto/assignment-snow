const ethers = require('ethers');

module.exports = {
    printBalance: async function (addr) {
        const balance = await addr.getBalance();
        console.log(ethers.utils.formatEther(balance.toString()));
    }
};