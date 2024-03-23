const GhostAdminAPI = require('@tryghost/admin-api');
const fs = require("fs")
const MarkdownIt = require("markdown-it");
const path = require('path');
const sharp = require('sharp')
const util = require('util')
const exec = util.promisify(require('child_process').exec);
require('dotenv').config();

var ghostUrl = process.env.GHOST_URL;
var ghostKey = process.env.GHOST_KEY;
var convertKitKey = process.env.CONVERTKIT_KEY;

// var mdFilePath = "C:\\Users\\brade\\Documents\\Personal Work\\BK Ideaverse\\Efforts\\Notes\\Grasshopper Findings (Personal Website)\\Grasshopper Keyboard Shortcuts Test.md";
// var attachmentsPath = "C:\\Users\\brade\\Documents\\Personal Work\\BK Ideaverse\\Atlas\\Utilities\\Images";
var mdFilePath = process.env.FILE_PATH
var attachmentsPath = process.env.ATTACHMENT_PATH;
var sendtoConvertKit = true;

var compressedPath = process.env.SCRATCH_PATH;

var fileLines = fs.readFileSync(mdFilePath, 'utf-8');

const md = new MarkdownIt({
    html: true,
})

// render md to html
var htmlContent = md.render(fileLines)

// replace media wikilinks with html img paths
htmlContent = htmlContent.replace(
    /<p>\!\[\[(.*?)\]\]<\/p>|<p>!\[.*?\]\((.*?)\)<\/p>/g,
    mediaWikiLinkReplacer
)

// Start the Ghost API service
const api = new GhostAdminAPI({
    url: ghostUrl,
    version: "v5.0",
    key: ghostKey
});

// Get the file name
const baseNameWithExtension = path.basename(mdFilePath);

// Get the extension of the file
const extension = path.extname(mdFilePath);

// Remove the extension from the base name to get the file name without the extension
const fileNameWithoutExtension = baseNameWithExtension.replace(extension, '');

//Upload the post to Ghost with images
processImagesInHTML(htmlContent)
    .then(html => {
        if (sendtoConvertKit){
            return fetch('https://api.convertkit.com/v3/broadcasts', {
                method: 'POST',
                headers: {
                    "Content-Type" : "application/json"
                },
                body: JSON.stringify(
                    {
                        "api_secret": convertKitKey,
                        "subject":fileNameWithoutExtension,
                        "content": html,
                        "email_layout_template": "GHEC"
                    }
                )
            })
        }
        return api.posts
            .add(
                {title: fileNameWithoutExtension, html},
                {source: 'html'} // Tell the API to use HTML as the content source, instead of Lexical
            )
            .then(res => JSON.stringify(res))
            .catch(err => console.log("error", err));
    })
    .catch(err => console.log("catched error", err))




// Utility function to replace [[media]] with real path
function mediaWikiLinkReplacer(match, p1) {

    if (p1.toLowerCase().includes(".png") ||
        p1.toLowerCase().includes(".jpg") ||
        p1.toLowerCase().includes(".jpeg") ||
        p1.toLowerCase().includes(".gif")) {
        return `<img src="${attachmentsPath + "/" + p1}" />`;
    }
    return "";
}

// Utility function to find and upload any images in an HTML string
async function processImagesInHTML(html) {
    // Find images that Ghost Upload supports
    let imageRegex = /="([^"]*?(?:\.jpg|\.jpeg|\.gif|\.png|\.svg|\.sgvz))"/gmi;
    let imagePromises = [];

    var result = [];
    while ((result = imageRegex.exec(html)) !== null) {
        let file = result[1];
        let compressedFile = result[1];
        let fileExt = path.extname(file);
        let fileName = path.basename(file);

        // Compress images and put them in the compressed path before uploading them
        if (fileExt.toLowerCase() === ".png") {
            await sharp(file)
                .png({compressionLevel: 9})
                .toFile(`${compressedPath}/${fileName}`)
            compressedFile = file.replace(attachmentsPath, compressedPath);
            html = html.replace(file, compressedFile);
        } else if (fileExt.toLowerCase() === ".jpg" || fileExt.toLowerCase() === ".jpeg") {
            await sharp(file)
                .jpeg({quality: 60})
                .toFile(`${compressedPath}/${fileName}`)
            compressedFile = file.replace(attachmentsPath, compressedPath);
            html = html.replace(file, compressedFile);
        } else if (fileExt.toLowerCase() === ".gif") {
            await exec(`gifsicle -O3 --lossy=80 "${file}" -o "${file.replace(attachmentsPath, compressedPath)}"`)
            // await exec(, ['-O3', '--lossy=80', file, '-o', file.replace(attachmentsPath, compressedPath)]);
            compressedFile = file.replace(attachmentsPath, compressedPath);
            html = html.replace(file, compressedFile);
        }

        // Upload the image, using the original matched filename as a reference
        imagePromises.push(api.images.upload({
            ref: compressedFile,
            file: path.resolve(compressedFile),
        }));
    }

    return Promise
        .all(imagePromises)
        .then(images => {
            images.forEach(image => html = html.replace(image.ref, image.url));
            console.log(html)
            return html;
        });
}