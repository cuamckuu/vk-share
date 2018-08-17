"use strict";

const argsFromObj = function (args) {
	return Object.keys(args)
					.reduce((res, key) => {
						res += `${key}=${args[key]}&`;
						return res;
					}, "");
};

const throwIfMissing = () => { throw new Error("Missing Arg") };

const callMethod = function (
		method,
		args_obj,
		accessToken = throwIfMissing(),
		callback
	) {
	//TODO: If auth error, remove authToken from localStorage

	const args = argsFromObj(args_obj);
	const apiURL = "https://api.vk.com/method/"
	// No need for '&' after "${agrs}"
	const params = `${method}?${args}access_token=${accessToken}&v=5.80`;

	let xhr = new XMLHttpRequest();

	xhr.onreadystatechange = function() {
		if (this.readyState === 4 && this.status === 200) {
			const response = JSON.parse(this.responseText);
			callback(response);
		}
	};

	const methodURL = apiURL + params;
	xhr.open("GET", methodURL, true);
  	xhr.send();
 };

const drawEnrty = function (
		title_text,
		photo_url,
		entry_id,
		callback = () => {}
	) {
	let title = document.createElement("span");
	if (title_text.length > 10) {
		title.innerHTML = title_text.slice(0, 7) + "...";
	} else {
		title.innerHTML = title_text;
	}

	let photo = document.createElement("img");
	photo.src = photo_url;

	let entry = document.createElement("div");
	entry.className = "entry";
	entry.setAttribute("entry_id", entry_id);
	entry.setAttribute("selected", "false");

	entry.append(photo);
	entry.append(document.createElement("br"));
	entry.append(title);

	entry.addEventListener("click", callback);

	document.getElementById("background").append(entry);
};

// TODO: Maybe get starting color from css to prevent color change after selection
const colors = {
	border_selected: "#45688E",
	text_selected: "#456484",
	border_not_selected: "lightgray",
	text_not_selected: "black"
};

let counter = 0;

const toggleUserSelection = function (e) {
	let entry = e.currentTarget;
	let image = entry.children[0];

	let imageStyle = getComputedStyle(image);
	if (entry.selected === "true") {
		image.style.borderColor = colors.border_not_selected;
		entry.style.color = colors.text_not_selected;
		entry.selected = "false";
		counter -= 1;
	} else {
		image.style.borderColor = colors.border_selected;
		entry.style.color = colors.text_selected;
		entry.selected = "true";
		counter += 1;
	}

	if (counter !== 0){
		document.getElementById("button").innerHTML = `Отправить (${counter})`;
	} else {
		document.getElementById("button").innerHTML = `Отправить`;
	}
};

const processChat = function (chat) {
	const chat_settings = chat.conversation.chat_settings;
	const id = chat.conversation.peer.id;

	const title_text = chat_settings.title;
	let photo_url = "https://vk.com/images/icons/im_multichat_50.png"
	if ("photo" in chat_settings) {
		photo_url = chat_settings.photo.photo_50;
	}

	drawEnrty(title_text, photo_url, id, toggleUserSelection);
};

const processUserOrGroup = function (user, profiles) {
	const id = user.conversation.peer.id;

	if (profiles[id] === undefined) return;

	const title_text = profiles[id][0];
	const photo_url = profiles[id][1];

	drawEnrty(title_text, photo_url, id, toggleUserSelection);
};

const processDialogs = function (json) {
	const conversations = json.response.items;

	const profiles = (json.response.profiles || []).reduce((res, val) => {
		res[val.id] = [val.first_name, val.photo_50];
		return res;
	}, {});
	const groups = (json.response.groups || []).reduce((res, val) => {
		res[val.id] = [val.name, val.photo_50];
		return res;
	}, {});

	console.log(groups);
	conversations.forEach((conv, i, arr) => {
		const type = conv.conversation.peer.type;
		if (type === "user") {
			processUserOrGroup(conv, profiles);
		} else if (type === "chat") {
			processChat(conv);
		} else if (type === "group") {
			processUserOrGroup(conv, groups);
		} else {
			throw new Error("Unknown Type");
		}
	});
};

const accessToken = localStorage.access_token;
if (accessToken !== undefined) {
	// TODO: Remove 'count' property and add slider and user search
	callMethod( "messages.getConversations",
				{
					"extended": "1",
					"count": "5"
				},
				accessToken,
				processDialogs
				);
} else {
	const authURL = "https://oauth.vk.com/authorize?client_id=6657002&scope=messages,offline&redirect_uri=https://oauth.vk.com/blank.html&display=page&response_type=token"

	chrome.tabs.create({url: authURL, selected: true}, (tab) => {
		localStorage.tabID = tab.id;
	});
}

document.addEventListener("DOMContentLoaded", function () {
	const processMessages = function (e) {
		chrome.tabs.query({"active": true, "lastFocusedWindow": true}, function (tabs) {
			const url = tabs[0].url.split("?")[0];
			const comment = document.getElementById("comment").value;
			const message = comment + " " + url;

			let code = "var arr = [];\n";
			const elts = document.getElementsByClassName("entry");
			let counter = 0;
			[].forEach.call(elts, (entry, i, arr) => {
				if (entry.selected === "true") {
					const entry_id = entry.getAttribute("entry_id");
					counter += 1;

					code += `arr.push(API.messages.send({
						"peer_id": "${entry_id}",
						"message": "${message}"
					}));\n`;
				}
			});
			code += "return arr;";

			if (counter === 0) window.close();

			const accessToken = localStorage.access_token;
			callMethod( "execute",
						{ "code": code },
						accessToken,
						(res) => {window.close()}
					  );
		});
	};

	document.getElementById("button").addEventListener("click", processMessages);
});
