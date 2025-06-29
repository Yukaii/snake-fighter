import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export const useSocket = (serverUrl = import.meta.env.VITE_SERVER_URL || '/') => {
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    console.log('Initializing socket connection to:', serverUrl)
    
    // Clean Socket.IO configuration for development
    socketRef.current = io(serverUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 2,
      reconnectionDelay: 1500,
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id)
      console.log('Transport:', socketRef.current.io.engine.transport.name)
      setIsConnected(true)
    })

    socketRef.current.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    // Log transport changes
    socketRef.current.on('upgrade', () => {
      console.log('Socket upgraded to:', socketRef.current.io.engine.transport.name)
    })

    socketRef.current.on('upgradeError', (error) => {
      console.error('Socket upgrade error:', error)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl])

  return { socket: socketRef.current, isConnected }
}
