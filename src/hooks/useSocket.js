import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export const useSocket = (serverUrl = import.meta.env.VITE_SERVER_URL || '/') => {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    console.log('Initializing socket connection to:', serverUrl)
    socketRef.current = io(serverUrl)

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id)
      setIsConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl])

  return { socket: socketRef.current, isConnected }
}
