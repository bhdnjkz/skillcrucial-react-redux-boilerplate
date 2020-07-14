import express from 'express'
import path from 'path'
import axios from 'axios'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { writeFile, readFile, unlink } = require('fs').promises

const Root = () => ''

// const { readFile, writeFile, stat, unlink } = require('fs.promises').promises

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const headers = (req, res, next) => {
  res.set('x-skillcrucial-user', '6ef49a8a-e582-4b44-8581-0d944986ab30');  
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
} 

const port = process.env.PORT || 8090
const server = express()

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  headers,
  cookieParser()
]

const writeFileWUsers = (user) => {
  return writeFile(`${__dirname}/users.json`, JSON.stringify(user), { encoding: "utf8" })
}

const readFileFunction = () => {
  return readFile(`${__dirname}/users.json`, { encoding: "utf8" })
    .then(show => JSON.parse(show))
    .catch(async () => {
      const users = await axios('https://jsonplaceholder.typicode.com/users').then(link => link.data)
      await writeFile(`${__dirname}/users.json`, JSON.stringify(users), { encoding: "utf8" });
    return users
    })
}

const deleteFile = () => {
  return unlink(`${__dirname}/users.json`)
}


middleware.forEach((it) => server.use(it))

server.get('/api/v1/users', async (req, res) => {
 const displayUsers = await readFileFunction()
 res.json(displayUsers)
})

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body
  const users = await readFileFunction()
  const lastUser = users[users.length - 1]
  const id = lastUser.id + 1
  const newUsers = [...users, {...newUser, id}]
  await writeFileWUsers(newUsers)
  res.json({ status: 'succes', id })
 })
  
server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const users = await readFileFunction()
  const list = users.map(((it) => it.id === +userId ? { ...it, ...req.body } : it ))
  await writeFileWUsers(list) 
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const users = await readFileFunction()
  const list = users.filter((it) => it.id !== +userId)
  await writeFileWUsers(list) 
  res.json({ status: 'success', "id": userId })
})

server.delete('/api/v1/users/', async (req, res) => {
  await deleteFile()
  res.end()
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart) 
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}

console.log(`Serving at http://localhost:${port}`)