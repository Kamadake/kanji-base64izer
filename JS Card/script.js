const angle = 0.618033988749895; //i * angle - i is the index of path
const saturation = 0.95;
const value = 0.75;
const timePerDot = 15;
const kanjiContainerID = "kanjiContainer";
const svgWidth = "300";
const svgHeight = "300";
const kanjiContainer = document.getElementById(kanjiContainerID);
const dataLengthAttributeName = "data-length";

/* Add leading zeros depending on the length of the string
* (Mainly used for string values representing hex values)
* @param value {string}
* @param expectedLength {number}
*/
function addLeadingZero(value, expectedLength) {
	while(value.length < expectedLength) {
		value = "0" + value;
	}

	return value;
}

/**
 * Taken from https://github.com/cayennes/kanji-colorize
 * @param {number} h hue value
 * @param {number} s saturation value
 * @param {number} v value...value?
 */
function HSVtoRGB(h, s, v) {
	var r, g, b, i, f, p, q, t;
	if (arguments.length === 1) {
		s = h.s, v = h.v, h = h.h;
	}
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}

/**
 * Pass on HSV values and get the hex value in return
 * e.g. 289, 42, 96 --> #e28ef5
 * @param {number} h hue value
 * @param {number} s saturation value
 * @param {number} v value...value?
 */
function HSVtoRGBHex(h, s, v) {
	let rgbColor = HSVtoRGB(h, s, v);
	let r = addLeadingZero(rgbColor.r.toString(16), 2);
	let g = addLeadingZero(rgbColor.g.toString(16), 2);
	let b = addLeadingZero(rgbColor.b.toString(16), 2);
	return `#${r}${g}${b}`;
}

// Contains methods to change Promise state of drawing
let nextDrawDeferred;

/**
 * Stops the animation drawing
 */
function stopDrawing() {
	if (nextDrawDeferred) {
		nextDrawDeferred.reject("Drawing Halted");
	}
}

/**
 * Iterate through the SVG Path elements and draw through them
 * by decreasing stroke-dashoffset from max value to 0.
 * @param {HTMLPathElement[]} paths Paths found inside the SVG Element
 */
async function drawPaths(paths) {
	let stopAnimation = false;
	for (const path of paths) {
		if (stopAnimation) {
			return;
		}

		const pathLength = path.getAttribute(dataLengthAttributeName);
		const timeToDraw = pathLength * timePerDot;

		let currentOffset = pathLength;
		let intervalID = setInterval(() => {
			path.style["stroke-dashoffset"] = currentOffset--;
			if (currentOffset <= 0) {
				clearInterval(intervalID);
			}
		}, timePerDot);
		
		await new Promise(function (resolve, reject) {
			nextDrawDeferred = {resolve: resolve, reject: reject};
			setTimeout(() => resolve(), timeToDraw);
		}).then(null, () => {clearInterval(intervalID); stopAnimation = true;});
	}
}

/**
 * Method call to animate the Kanji SVG
 * @param {HTMLElement} kanjiObject Element that should contain all the necessary <path> nodes
 */
function animateKanji(kanjiObject) {
	if (kanjiObject) {
		let kanjiPaths = kanjiObject.querySelectorAll("path");
		// Set all path dashoffset to their array length
		for (const path of kanjiPaths) {
			path.setAttribute(dataLengthAttributeName, Math.ceil(path.getTotalLength()));
			path.style["stroke-dasharray"] = path.getAttribute(dataLengthAttributeName);
			path.style["stroke-dashoffset"] = path.getAttribute(dataLengthAttributeName);
		}

		// Pass all the paths to an async function that will wait for each
		// stroke to be drawn
		drawPaths(kanjiPaths);
	}
}

/**
 * Method call to color the Kanji SVG
 * @param {HTMLElement} kanjiObject Element that should contain all the necessary <path> nodes
 */
function colorKanji(kanjiObject) {
	if (kanjiObject) {
		stopDrawing();
		kanjiObject.classList.remove("onlyStrokes");
		let kanjiPaths = kanjiObject.querySelectorAll("path");
		for (let i = 0; i < kanjiPaths.length; i++) {
			const path = kanjiPaths[i];
			path.style["stroke"] = HSVtoRGBHex(i * angle, saturation, value);
		}
	}
}

/**
 * Method call to revert the Kanji SVG to its default state
 * @param {HTMLElement} kanjiObject Element that should contain all the necessary <path> nodes
 */
function onlyStrokes(kanjiObject) {
	if (kanjiObject) {
		stopDrawing();
		kanjiObject.classList.add("onlyStrokes");
		let kanjiPaths = kanjiObject.querySelectorAll("path");

		for (let i = 0; i < kanjiPaths.length; i++) {
			const path = kanjiPaths[i];
			path.style["stroke"] = "#000000";
		}
	}
}

/** @enum */
const kanjiJobs = {
	color: 1,
	animate: 2,
}

/**
 * Return HTML Node generated from String
 * @param {string} htmlText 
 * @returns {HTMLElement}
 */
function generateHTMLFromString(htmlText) {
	/** @type {HTMLTemplateElement} */
	const template = document.createElement("template");

	template.innerHTML = htmlText;
	if (template.content.firstChild)
		return template.content.firstChild;
}

/**
 * Return HTML Node generated from Base64 String
 * @param {string} base64Text Base64 encoded text that represents the HTML to be generated
 * @returns {HTMLElement}
 */
function generateHTMLFromBase64(base64Text) {
	return generateHTMLFromString(atob(base64Text));
}

/**
 * Download Kanji SVG that is stored in collection.media and output it
 * into the specified <div> container
 * @param kanjiChar {string}
 * @param kanjiJob {kanjiJobs}
 */
function setKanjiChar(kanjiChar, kanjiJob) {
	let charUnicode = addLeadingZero(kanjiChar.charCodeAt(0).toString(16), 5);
	console.info(`Kanji Inputted: ${kanjiChar} (${charUnicode})`)

	while(kanjiContainer.lastChild) {
		kanjiContainer.removeChild(kanjiContainer.lastChild);
	}

	if (encodedSVG) {
		const svgElement = generateHTMLFromBase64(encodedSVG);
		svgElement.setAttribute("width", svgWidth);
		svgElement.setAttribute("height", svgHeight);
		
		kanjiContainer.appendChild(svgElement);

		switch(kanjiJob) {
			case kanjiJobs.color:
				colorKanji(kanjiContainer);
				break;
			case kanjiJobs.animate:
				colorKanji(kanjiContainer);
				animateKanji(kanjiContainer);
				break;
			default:
				onlyStrokes(kanjiContainer);
				break;
		}
	}
}

function toggleStrokeOrder() {
	if (kanjiContainer.classList.contains("onlyStrokes")) {
		colorKanji(kanjiContainer);
	} else {
		onlyStrokes(kanjiContainer);
	}
}

function toggleSVG() {
	kanjiContainer.classList.toggle("hideSVG");
}

function reanimateKanji() {
	stopDrawing();
	animateKanji(kanjiContainer);
}