// ==UserScript==
// @name         Microsoft Bing Rewards每日任务脚本-全自动版
// @version      V3.1.0
// @description  自动完成微软Rewards每日搜索任务,每次运行时获取抖音/微博/哔哩哔哩/百度热门词,避免使用同样的搜索词被封号。
// @note         基于怀沙2049的脚本
// @author       pacinor
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @match        https://rewards.bing.com/*
// @license      GNU GPLv3
// @icon         https://www.bing.com/favicon.ico
// @connect      tenapi.cn
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @namespace    https://pacinor.github.io/Microsoft-Rewards
// ==/UserScript==

// bing url 国外填https://www.bing.com,国内填https://cn.bing.com
var bing_url = 'https://cn.bing.com'

//自动判断是否为手机
var is_phone = /Mobi|Android|iPhone/i.test(navigator.userAgent)

var auto_start = true //搜索计数是否每天自动清零 (是否自动启动,需要手动刷新网页)

// 手机端23次可得60分,电脑端33次90分
var max_rewards
if (is_phone) {
    max_rewards = 24; //重复执行的次数
} else {
    max_rewards = 34; //重复执行的次数
}

//每执行4次搜索后插入暂停时间,解决账号被监控不增加积分的问题
var pause_time = 60000; // 暂停时长建议为10分钟（600000毫秒=10分钟）
var search_words = []; //搜索词

//默认搜索词，热门搜索词请求失败时使用
var default_search_words = ["盛年不重来，一日难再晨", "千里之行，始于足下", "少年易学老难成，一寸光阴不可轻", "敏而好学，不耻下问", "海内存知已，天涯若比邻", "三人行，必有我师焉",
    "莫愁前路无知已，天下谁人不识君", "人生贵相知，何用金与钱", "天生我材必有用", "海纳百川有容乃大；壁立千仞无欲则刚", "穷则独善其身，达则兼济天下", "读书破万卷，下笔如有神",
    "学而不思则罔，思而不学则殆", "一年之计在于春，一日之计在于晨", "莫等闲，白了少年头，空悲切", "少壮不努力，老大徒伤悲", "一寸光阴一寸金，寸金难买寸光阴", "近朱者赤，近墨者黑",
    "吾生也有涯，而知也无涯", "纸上得来终觉浅，绝知此事要躬行", "学无止境", "己所不欲，勿施于人", "天将降大任于斯人也", "鞠躬尽瘁，死而后已", "书到用时方恨少", "天下兴亡，匹夫有责",
    "人无远虑，必有近忧", "为中华之崛起而读书", "一日无书，百事荒废", "岂能尽如人意，但求无愧我心", "人生自古谁无死，留取丹心照汗青", "吾生也有涯，而知也无涯", "生于忧患，死于安乐",
    "言必信，行必果", "读书破万卷，下笔如有神", "夫君子之行，静以修身，俭以养德", "老骥伏枥，志在千里", "一日不读书，胸臆无佳想", "王侯将相宁有种乎", "淡泊以明志。宁静而致远,", "卧龙跃马终黄土"]
//{weibohot}微博热搜榜//{douyinhot}抖音热搜榜/{zhihuhot}知乎热搜榜/{baiduhot}百度热搜榜/{toutiaohot}今日头条热搜榜/
// var keywords_source = ['douyinhot', 'zhihuhot', 'baiduhot', 'toutiaohot'];
// var random_keywords_source = keywords_source[Math.floor(Math.random() * keywords_source.length)]

// var current_source_index = 0; // 当前搜索词来源的索引
// 适配了tenapi.cn,api.vvhan.com,api-hot.efefee.cn(https://github.com/imsyy/DailyHotApi)的热词api
var keywords_source = [
    { url: "https://tenapi.cn/v2/douyinhot", data_parse: (data) => { return data.data.map(item => item.name) } },
    { url: "https://api-hot.efefee.cn/bilibili", data_parse: (data) => { return data.data.map(item => item.title) } },
    { url: "https://api.vvhan.com/api/hotlist/baiduRD", data_parse: (data) => { return data.data.map(item => item.title) } },

    { url: "https://tenapi.cn/v2/zhihuhot", data_parse: (data) => { return data.data.map(item => item.name) } },
    { url: "https://api-hot.efefee.cn/zhihu", data_parse: (data) => { return data.data.map(item => item.title) } },
    { url: "https://api.vvhan.com/api/hotlist/bili", data_parse: (data) => { return data.data.map(item => item.title) } },

    { url: "https://tenapi.cn/v2/baiduhot", data_parse: (data) => { return data.data.map(item => item.name) } },
    { url: "https://api.vvhan.com/api/hotlist/zhihuHot", data_parse: (data) => { return data.data.map(item => item.title) } },

    { url: "https://tenapi.cn/v2/toutiaohot", data_parse: (data) => { return data.data.map(item => item.name) } },
    { url: "https://api.vvhan.com/api/hotlist/wbHot", data_parse: (data) => { return data.data.map(item => item.title) } },
]

// 新增每日自动清零计数,不需要手动开始
function set_run_data(data) {
    GM_setValue('RunData', JSON.stringify(data));
}
function get_run_data() {
    return JSON.parse(GM_getValue('RunData'))
}

var default_run_data = {
    date: "",
    keywords: default_search_words,
    is_fetch_keywords: false,//是否获取关键词标记
    current_source_index: 0,
    manual_stop: false, // 是否手动停止
    points_done: false // 是否完成了每日活动
}
//
var run_data = JSON.parse(JSON.stringify(default_run_data))
if (GM_getValue('RunData') == null) {
    set_run_data(default_run_data)
}
else {
    run_data = get_run_data()
}
// 计算是否为同一天,如果不是同一天将自动开始
var date = new Date()

const time_today = "" + date.getFullYear() + (date.getMonth() + 1) + date.getDate()
if (time_today != run_data.date && auto_start) {
    // 重置设置,继承前一天的搜索词
    run_data.date = time_today
    run_data.is_fetch_keywords = false
    run_data.current_source_index = 0
    run_data.points_done = false
    GM_setValue('Cnt', 0); // 如果是新的一天,并且autostart为true,将计数器重置为0
    set_run_data(run_data)
}

async function sleep(t) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, t); // 2000 毫秒等于 2 秒
    });
}
/**
 * 尝试从多个搜索词来源获取搜索词，如果所有来源都失败，则返回默认搜索词。
 * @returns {Promise<string[]>} 返回搜索到的name属性值列表或默认搜索词列表
 */
async function douyinhot_dic() {
    // 如果今天获取成功过搜索词,那就跳出
    if (run_data.is_fetch_keywords) {
        return run_data.keywords
    }

    while (run_data.current_source_index < keywords_source.length) {
        const source = keywords_source[run_data.current_source_index]; // 获取当前搜索词来源
        try {
            const response = await fetch(source.url); // 发起网络请求
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status); // 如果响应状态不是OK，则抛出错误
            }
            const data = await response.json(); // 解析响应内容为JSON

            if (data.data.some(item => item)) {
                // 如果数据中存在有效项
                // 提取返回数据中的元素
                // const names = data.data.map(item => item.name);
                console.log("提取返回数据中的元素", data);

                let names = source.data_parse(data);

                // 将昨天的关键词和这次获取的关键词合并,解决部分接口返回关键词数量不够的问题
                if (names.length < max_rewards) {
                    let last_keywords = run_data.keywords
                    last_keywords.length = max_rewards - names.length + 5
                    names = names.concat(last_keywords)
                }


                // 获取关键词后,将已获取标记设为true,当天内的下次搜索不需要再获取关键词
                run_data.is_fetch_keywords = true
                run_data.keywords = names
                set_run_data(run_data)
                console.log("run_data:", run_data);

                return names; // 返回搜索到的name属性值列表
            }
        } catch (error) {
            // 当前来源请求失败，记录错误并尝试下一个来源
            console.error('搜索词来源请求失败:', error);
        }
        await sleep(1000)
        // 尝试下一个搜索词来源
        run_data.current_source_index++;
    }

    // 所有搜索词来源都已尝试且失败
    console.error('所有搜索词来源请求失败');
    return default_search_words; // 返回默认搜索词列表
}


// 定义菜单命令：开始
let menu1 = GM_registerMenuCommand('开始', function () {
    run_data.manual_stop = false
    set_run_data(run_data)
    GM_setValue('Cnt', 0); // 将计数器重置为0
    location.href = "https://www.bing.com/?br_msg=Please-Wait"; // 跳转到Bing首页
}, 'o');

// 定义菜单命令：停止
let menu2 = GM_registerMenuCommand('停止', function () {
    run_data.manual_stop = true
    set_run_data(run_data)
    GM_setValue('Cnt', max_rewards + 10); // 将计数器设置为超过最大搜索次数，以停止搜索
}, 'o');

// 定义菜单命令：重置
let menu3 = GM_registerMenuCommand('重置', function () {
    set_run_data(default_run_data) // 重置rundata为默认设置
    alert("已重置,请刷新页面")
}, 'o');

// 自动将字符串中的字符进行替换
function AutoStrTrans(st) {
    let yStr = st; // 原字符串
    let rStr = ""; // 插入的混淆字符，可以自定义自己的混淆字符串
    let zStr = ""; // 结果字符串
    let prePo = 0;
    for (let i = 0; i < yStr.length;) {
        let step = parseInt(Math.random() * 5) + 1; // 随机生成步长
        if (i > 0) {
            zStr = zStr + yStr.substr(prePo, i - prePo) + rStr; // 将插入字符插入到相应位置
            prePo = i;
        }
        i = i + step;
    }
    if (prePo < yStr.length) {
        zStr = zStr + yStr.substr(prePo, yStr.length - prePo); // 将剩余部分添加到结果字符串中
    }
    return zStr;
}

// 生成指定长度的包含大写字母、小写字母和数字的随机字符串
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        // 从字符集中随机选择字符，并拼接到结果字符串中
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

async function exec() {
    // 生成随机延迟时间
    let randomDelay = Math.floor(Math.random() * 20000) + 10000; // 10000 毫秒 = 10 秒
    let randomString = generateRandomString(4); //生成4个长度的随机字符串
    let randomCvid = generateRandomString(32); //生成32位长度的cvid

    // 检查计数器的值，若为空则设置为超过最大搜索次数
    if (GM_getValue('Cnt') == null) {
        GM_setValue('Cnt', max_rewards + 10);
    }

    // 获取当前搜索次数
    let currentSearchCount = GM_getValue('Cnt');
    // 如果当前次数小于最大次数,才获取搜索词条
    if (currentSearchCount <= max_rewards) {
        search_words = await douyinhot_dic()
    }
    // 根据计数器的值选择搜索引擎
    if (currentSearchCount <= max_rewards) {
        let tt = document.getElementsByTagName("title")[0];
        tt.innerHTML = "[" + currentSearchCount + " / " + max_rewards + "] " + tt.innerHTML; // 在标题中显示当前搜索次数

        let this_pause_time = 0
        if ((currentSearchCount + 1) % 5 === 0) {
            this_pause_time = pause_time
        }
        await sleep(randomDelay + this_pause_time)

        GM_setValue('Cnt', currentSearchCount + 1); // 将计数器加1
        let nowtxt = search_words[currentSearchCount]; // 获取当前搜索词

        if (!is_phone) {
            nowtxt = AutoStrTrans(nowtxt); // 如果不是手机端,对搜索词进行替换
        }
        location.href = bing_url + "/search?q=" + encodeURI(nowtxt) + "&form=" + randomString + "&cvid=" + randomCvid; // 在Bing搜索引擎中搜索
    }else if(currentSearchCount == max_rewards+1){
        await sleep(10000)
        GM_setValue('Cnt', currentSearchCount + 1); // 将计数器加1
        location.href = "https://rewards.bing.com"
    }
}


// 自动点击https://rewards.bing.com/?form=edgepredeem 中的活动

let gain_points = async () => {
    // 如果已完成或者手动停止 或是手机
    if( run_data.manual_stop || is_phone){
        return
    }
    // 等一段时间,页面加载
    await sleep(100000)
    while (!run_data.points_done) {
        // 完成了搜索,在rewards首页,时间在中午12点以后
        let date = new Date()
        if (date.getHours()>12) {
            let point_btns = document.querySelectorAll(".mee-icon-AddMedium")
            for(let btn of point_btns){
                btn.click()
                await sleep(40000)
            }
            // 设为完成
            run_data.points_done = true
            set_run_data(run_data)
        }
        console.log('等待十分钟,当前:'+date.getHours() + "-"+date.getMinutes());
        await sleep(600000)
    }
}

//页面加载完成后3秒再执行,避免部分情况下报错
setTimeout(async () => {
    if(!location.href.startsWith("https://rewards.bing.com")){
        await exec()
    }else{
        await gain_points()
    }
}, 3000)