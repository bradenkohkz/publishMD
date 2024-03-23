# Publish Markdown to Ghost/Convertkit

This repo is just a simple script that helps me publish a markdown file to Ghost and/or Convertkit. 


The reason is because I write in Obsidian and find it difficult to always convert them into the respective platforms when it's time to publish. 


So I wrote this script to help me.

This is what the script is doing on a high level. 

1. Read the lines of a markdown file 
2. Render the markdown into HTML content
3. Replace the media (.jpg, .png, etc.) wiki links with the appropriate html `<img src="">` tags
4. Then for each `img` tag it finds, it will compress then upload the image to Ghost 
5. It will then replace the local path in `src=` with the uploaded url in the html content
6. Then if `sendToConvertKit is true`, it will `POST` to convertkit 
7. and then upload the post to Ghost