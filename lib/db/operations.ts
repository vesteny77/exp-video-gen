import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface AppDB extends DBSchema {
  pipeline: {
    key: string
    value: any
  }
  chat: {
    key: string
    value: {
      id: string
      messages: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
        timestamp: Date
      }>
    }
  }
  artifacts: {
    key: string
    value: {
      id: string
      type: 'script' | 'audio' | 'video'
      url: string
      metadata: any
      createdAt: Date
    }
  }
}

let db: IDBPDatabase<AppDB> | null = null

async function getDB() {
  if (!db) {
    db = await openDB<AppDB>('avatar-video-gen', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pipeline')) {
          db.createObjectStore('pipeline')
        }
        if (!db.objectStoreNames.contains('chat')) {
          db.createObjectStore('chat')
        }
        if (!db.objectStoreNames.contains('artifacts')) {
          db.createObjectStore('artifacts')
        }
      },
    })
  }
  return db
}

export async function saveToIndexedDB(key: string, value: any) {
  try {
    const database = await getDB()
    await database.put('pipeline', value, key)
  } catch (error) {
    console.error('Failed to save to IndexedDB:', error)
  }
}

export async function loadFromIndexedDB(key: string) {
  try {
    const database = await getDB()
    return await database.get('pipeline', key)
  } catch (error) {
    console.error('Failed to load from IndexedDB:', error)
    return null
  }
}

export async function saveChatMessage(sessionId: string, message: any) {
  try {
    const database = await getDB()
    const session = await database.get('chat', sessionId) || { id: sessionId, messages: [] }
    session.messages.push({ ...message, timestamp: new Date() })
    await database.put('chat', session, sessionId)
  } catch (error) {
    console.error('Failed to save chat message:', error)
  }
}

export async function loadChatSession(sessionId: string) {
  try {
    const database = await getDB()
    return await database.get('chat', sessionId)
  } catch (error) {
    console.error('Failed to load chat session:', error)
    return null
  }
}

export async function saveArtifact(artifact: any) {
  try {
    const database = await getDB()
    await database.put('artifacts', { ...artifact, createdAt: new Date() }, artifact.id)
  } catch (error) {
    console.error('Failed to save artifact:', error)
  }
}

export async function loadArtifacts() {
  try {
    const database = await getDB()
    return await database.getAll('artifacts')
  } catch (error) {
    console.error('Failed to load artifacts:', error)
    return []
  }
}

export async function clearAllData() {
  try {
    const database = await getDB()
    await database.clear('pipeline')
    await database.clear('chat')
    await database.clear('artifacts')
  } catch (error) {
    console.error('Failed to clear data:', error)
  }
}