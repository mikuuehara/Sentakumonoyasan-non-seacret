const rp = require('request-promise');
const MY_WEATHER_APIKEY = '***********************';
const LAT = '***********************';  //緯度
const LON = '***********************';  //経度

// 現在時刻 : Date
let Now = new Date();

// 1時間前の時刻 : Date
let oneHourLater = new Date();
oneHourLater.setHours(Now.getHours() + -1);
console.log(String(Math.round(oneHourLater.getTime() / 1000)))
const req = 'http://api.openweathermap.org/data/2.5/onecall?lat='+LAT+'&lon='+LON+'&appid='+ MY_WEATHER_APIKEY;
const reqPast = 'http://api.openweathermap.org/data/2.5/onecall/timemachine?lat='+LAT+'&lon='+LON+'&dt='+String(Math.round(oneHourLater.getTime() / 1000))+'&appid='+ MY_WEATHER_APIKEY;

// alexa
const alexarp = require('request-promise');
const clientId = '***********************';
const clientSecret = '***********************';
let resultDic = {};

// 洗濯物を干せる天気ならtrue
const checkWeather = (id) =>{
    switch(id){
        case 800 :
        case 801 :
        case 802 :
        case 803 :
        case 804 :
            return true;
        default :
            return false;
    }
}

const ConvertJST = (unix) => {
    // 9h = 9*60*60s
    let time = new Date((unix + (9*60*60)) * 1000);
    return time;
}

const getJson = (uri) => {
    var options = {
        uri : uri,
        transform: (body) => JSON.parse(body)
    }
    return rp(options)
}

const getWeatherResultDic = async() => {
    resultDic["pastWeather"] = getPastWeather(await getJson(reqPast));
    resultDic["currentWeather"] = getCurrentWeather(await getJson(req));
    resultDic["futureWeather"] = getFutureWeather(await getJson(req))
    return resultDic;
}

const getCurrentWeather = (json) => {
    console.log("current : "+ConvertJST(json.current.dt));
    console.log(json.current.weather[0]);
    return checkWeather(json.current.weather[0].id);
}

const getPastWeather = (json) => {
    console.log("past : "+ConvertJST(json.current.dt));
    console.log(json.current.weather[0]);
    return checkWeather(json.current.weather[0].id);
}

const getFutureWeather = (json) => {
    console.log("future : "+ConvertJST(json.hourly[1].dt));
    console.log(json.hourly[1].weather[0]);
    return checkWeather(json.hourly[1].weather[0].id);
}


const notify = async(name) => {
    const token = await getToken(clientId, clientSecret);
    // console.log(`[DEBUG] access_token: ${token}`);
    const result = await sendEvent(token, name);
    return result;
}

const getToken = async(clientId, clientSecret) => {
    const uri = 'https://api.amazon.com/auth/o2/token'

    let body = 'grant_type=client_credentials';
    body += '&client_id=' + clientId;
    body += '&client_secret=' + clientSecret;
    body += '&scope=alexa::proactive_events';

    const options = {
        method: 'POST',
        uri: uri,
        timeout: 30 * 1000,
        body: body,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    const data = await alexarp(options);
    const tokenResult = JSON.parse(data)
    // console.log(tokenResult)
    return tokenResult.access_token;
}

const sendEvent = async(token, name) => {
    const body = JSON.stringify(mediaContentAvailableEvent(name));
    const uri = 'https://api.fe.amazonalexa.com/v1/proactiveEvents/stages/development'

    const options = {
        method: 'POST',
        uri: uri,
        timeout: 30 * 1000,
        body: body,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length,
            'Authorization' : 'Bearer ' + token
        }
    };
    await alexarp(options);
}

const mediaContentAvailableEvent = (name) => {
    let timestamp = new Date();
    let expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 60);

    return {
        'timestamp': timestamp.toISOString(),
        'referenceId': 'id-'+ new Date().getTime(),
        'expiryTime': expiryTime.toISOString(),
        'event': {
            'name': 'AMAZON.MessageAlert.Activated',
            'payload': {
              'state': {
                'status': 'UNREAD',
                'freshness': 'NEW'
              },
              'messageGroup': {
                'creator': {
                  'name': name
                },
                'count': 1
              }
            }
          },
        'localizedAttributes': [
            {
                'locale': 'ja-JP',
                'providerName': 'proactive event api sample',
                'contentName': 'push notification test'
            }
        ],
        //'relevantAudience': {
        //    'type': 'Multicast',
        //    'payload': {}
        //}
        'relevantAudience': {
            'type': 'Unicast',
            'payload': {
                'user': 'amzn1.ask.account.***********************'
            }
        }
    }
}


// 実行
const hour = Now.getHours()+9;
console.log("Hour : ", hour);
// const hour = 10;
if(9 < hour & hour < 16){
    // 10-16時の間の場合
    getWeatherResultDic().then((weathertDic) =>{
        console.log("WeatherDictionary : ", weathertDic);
        if(weathertDic["currentWeather"]){
            // 現在晴れの場合
            if(weathertDic["currentWeather"] === weathertDic["futureWeather"]){
                // 1時間後の天気==現在の天気
                if(weathertDic["currentWeather"] === weathertDic["pastWeather"]){
                    // 1時間前の天気==現在の天気
                    console.log("いい天気");
                    return true;
                }else{
                    if(hour < 13){
                        // 通知
                        notify("sentakumonohosiyasan").then(() => {
                            console.log('success');
                            console.log("晴れました");
                            return true;
                        }).catch(err => {
                            console.log('err : ' +err);
                            return false;
                        });
                    }else{
                        return true;
                    }
                }
            }else{
                // 通知
                notify("sentakumonosimaiyasan").then(() => {
                    console.log('success');
                    console.log("雨が降ります");
                    return true;
                }).catch(err => {
                    console.log('err : ' +err);
                    return false;
                });
            }
        }else{
            // 現在雨の場合
            console.log("雨です");
            return true;
        }
    }).catch((err) =>{
        console.log(err);
        return false;
    })
}else{
    console.log("sleeping");
    return true;
}