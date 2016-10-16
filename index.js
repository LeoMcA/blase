#!/usr/bin/env node

/**
 * Module dependencies.
 */

const program = require('commander')
const fs = require('fs-extra')
const path = require('path')
const hjson = require('hjson')
const ejs = require('ejs')
const md = require('commonmark')

program
  .version('0.0.1')
  .option('-i, --input [folder]', 'Input folder')
  .option('-o, --output [folder]', 'Output folder')
  .parse(process.argv)

var site = {
  posts: []
}

var layouts = {

}

parseDir(path.join(program.input, '_layouts'), filePath => {
  parseFile(filePath, (metadata, body) => {
    var layoutName = path.basename(filePath, '.html')
    layouts[layoutName] = {}
    layouts[layoutName].render = ejs.compile(body)
    if (metadata) {
      layouts[layoutName].parent = metadata.layout
    }
  })
})

parseDir(path.join(program.input, '_posts'), filePath => {
  parseFile(filePath, (metadata, body) => {
    if (metadata) {
      var fileName = path.basename(filePath, '.md')
      metadata.url = `posts/${fileName}.html`
      metadata.date = new Date(metadata.date)
      site.posts.push(metadata)
      var mdReader = new md.Parser()
      var mdWriter = new md.HtmlRenderer()
      var html = mdWriter.render(mdReader.parse(body))
      renderTemplate(metadata, html, html => {
        fs.outputFile(path.join(program.output, 'posts', `${fileName}.html`), html, err => {
          if (err) console.error(err)
        })
      })
    }
  })
})

function renderTemplate (metadata, content, callback) {
  var layout = layouts[metadata.layout]
  var html = layout.render({
    site: site,
    page: metadata,
    content: ejs.render(content, { site: site, page: metadata }, {})
  })
  if (layout.parent) {
    metadata.layout = layout.parent
    renderTemplate(metadata, html, callback)
  } else {
    callback(html)
  }
}

parseDir(program.input, filePath => {
  parseFile(filePath, (metadata, body) => {
    var relativePath = path.relative(program.input, filePath)
    if (metadata) {
      renderTemplate(metadata, body, html => {
        fs.outputFile(path.join(program.output, relativePath), html, err => {
          if (err) console.error(err)
        })
      })
    } else {
      fs.copy(filePath, path.join(program.output, relativePath), err => {
        if (err) console.error(err)
      })
    }
  })
})

function parseDir (dir, callback) {
  fs.readdir(dir, (err, files) => {
    if (err) console.error(err)
    files.forEach(file => {
      var filePath = path.join(dir, file)
      fs.stat(filePath, (err, stats) => {
        if (err) console.error(err)
        if (stats.isDirectory()) {
          var basename = path.basename(filePath)
          if (basename[0] === '_') return
          parseDir(filePath, callback)
        } else if (stats.isFile()) {
          callback(filePath)
        }
      })
    })
  })
}

function parseFile (filePath, callback) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) console.error(err)
    if (data[0] === '{') {
      var result = /^({(?:.|\n)*?^})((?:.|\n)*)/m.exec(data)
      var metadata = result[1]
      var body = result[2]
      metadata = hjson.parse(metadata)
      callback(metadata, body)
    } else {
      callback(false, data)
    }
  })
}
