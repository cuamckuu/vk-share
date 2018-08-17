"use strict";

const isValid = (val) => { return val !== undefined };

chrome.tabs.onUpdated.addListener(function (id, info) {
    const tabID = +localStorage.tabID;
    const url = info.url;

    if ([tabID, url].every(isValid) && id === tabID && info.status === "loading") {
        if (info.url.indexOf("oauth.vk.com/blank.html") !== -1){
            const args_index = url.indexOf("#") + 1;

            const args = url
                        .slice(args_index)
                        .split("&")
                        .map(param => param.split("="))
                        .reduce((res, item) => {
                            res[item[0]] = item[1];
                            return res;
                        }, {});

            if ("access_token" in args) {
                alert("success");
                localStorage.access_token = args.access_token;
            } else if ("error" in args) {
                alert("error");
            }

            delete localStorage.tabID;
        }
    }
});
