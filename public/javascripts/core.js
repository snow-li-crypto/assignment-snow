const cronos_testnet_chainId = '0x152'
const cronos_mainnet_chainId = '0x19'

function log(obj){
    let text = JSON.stringify(obj);
    $("#logs").append('<br> >  ' + text.replaceAll('"', ''));
}

async function connectWallet(cronos_chainId){

    if(!cronos_chainId){
        log('cronos_chainId is require!');
        return;
    }

    if(!window.ethereum){
        log('window.ethereum not find!');
        return;
    }
 
    if(window.ethereum.chainId != cronos_chainId){
        ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: cronos_chainId }],
            }).then(function(result){
                
                log('switchEthereumChain to ' + cronos_chainId);    
                doConnectWallet();

            });

        
    }else{
        doConnectWallet();
    }

}

async function doConnectWallet(){
    window.context.provider = new ethers.providers.Web3Provider(window.ethereum)
    // MetaMask requires requesting permission to connect users accounts
    window.context.provider.send("eth_requestAccounts", []).then(function(result){
        log('connectWallet success!');
    });
}



function cacheSmartContract(contractConfig){

    let contract = window.context.contracts[contractConfig.address];
    if(contract){
        return contract;
    }

    if(!window.context.provider){
        log('please connect wallet!');
        return ;
    }

    contract = new ethers.Contract(contractConfig.address, contractConfig.contractABI, window.context.provider.getSigner());
    log('bulidSmartContract - ' + contractConfig.address);
    window.context.contracts[contractConfig.address] = contract;
    return contract;
}

function resultHandle(key, result){
    if(!convert[key]){
        log(result);
        return;
    }
    log(convert[key].apply({}, [result]))
}

const convert = 
{
    'latestAnswer': function (result){ return 'BTC/USD : ' + result.toNumber()/100000000  + ' $' }
}


function loadParams(contractABI){
    var methodName =  $('#salutation').select().val();
    if(!methodName){
        log('plase select method name!');
        return;
    }
    $('#params').empty();
    contractABI.forEach(function(item){
        if(item.name == methodName){
            if(item.inputs.length > 0){
                item.inputs.forEach(function(item){
                    $("#params").append('<label for="tags">'+item.name+': </label><input id="'+item.name+'"> ');
                });
            }
        }
    });
}

function randomHex(){
    return '0x' + Math.ceil(Math.random()* 100000000).toString(16);
}


function weatherEncode(temperature){
    //+30.1 °C
    let temperatureFloat = parseFloat(temperature);

    let code = '0x';

    let _1_hex = parseInt(1).toString(16)
    let _2_hex = parseInt(2).toString(16)
    let _3_hex = parseInt(3).toString(16)
    if(temperatureFloat < 0){
        temperatureFloat = Math.abs(temperatureFloat);
        code = code + _1_hex;
    }else if(temperature.indexOf('+') > -1){
        code = code + _2_hex;
    }else {
        code = code + _3_hex;
    }
    

    let array = (temperatureFloat + '').split('.');
    if(array.length == 1){
        code = code + temperatureFloat.toString(16).padStart(2, '0') + '0000'
    }else{
        code = code + parseInt(array[0]).toString(16).padStart(2, '0');
        code = code + parseInt(array[1]).toString(16).padStart(2, '0');
    }
    return code;
}

function weatherDecode(temperature){
    if(temperature == 0){
        return 'pengding....';
    }
    let _hex = temperature.toString(16);
    let prefix = _hex.substr(0, 1);
    let symbol = prefix == '1' ? '-' : prefix == '2' ?  '+' : '';
    let decimal = parseInt(_hex.substr(3), 16);
    if(decimal > 0){
        return symbol + parseInt(_hex.substr(1, 2), 16) + '.' +  parseInt(_hex.substr(3), 16) + ' °C';
    }else{
        return symbol + parseInt(_hex.substr(1, 2), 16) + ' °C';
    }
    
}