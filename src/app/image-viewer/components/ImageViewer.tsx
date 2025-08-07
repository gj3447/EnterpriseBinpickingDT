'use client';

import { useEffect, useState } from 'react';

const ENDPOINTS = [
  { path: '/ws/board_perspective_jpg', title: 'Board Perspective' },
  { path: '/ws/color_jpg', title: 'Color Image' },
  { path: '/ws/depth_jpg', title: 'Depth Image' },
  { path: '/ws/aruco_debug_jpg', title: 'ArUco Debug' },
];

const WEBSOCKET_URL_BASE = 'ws://192.168.0.196:52000';

const LoadingIndicator = () => (
    <div className="flex items-center justify-center h-full">
        <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-neutral-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
            <div className="w-4 h-4 rounded-full bg-neutral-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-4 h-4 rounded-full bg-neutral-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
    </div>
);

const ImageViewer = () => {
  const [images, setImages] = useState<string[]>(Array(ENDPOINTS.length).fill(''));
  const [connectionStatus, setConnectionStatus] = useState<('connecting' | 'open' | 'closed')[]>(Array(ENDPOINTS.length).fill('connecting'));

  useEffect(() => {
    const sockets: WebSocket[] = [];

    ENDPOINTS.forEach((endpoint, index) => {
      const ws = new WebSocket(`${WEBSOCKET_URL_BASE}${endpoint.path}`);
      
      ws.onopen = () => {
        console.log(`WebSocket open for ${endpoint.path}`);
        setConnectionStatus(prev => {
            const newStatus = [...prev];
            newStatus[index] = 'open';
            return newStatus;
        });
      };
      
      ws.onclose = () => {
        console.log(`WebSocket closed for ${endpoint.path}`);
        setConnectionStatus(prev => {
            const newStatus = [...prev];
            newStatus[index] = 'closed';
            return newStatus;
        });
      };
      
      ws.onerror = (error) => console.error(`WebSocket error for ${endpoint.path}:`, error);

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            setImages((prev) => {
              const newImages = [...prev];
              newImages[index] = result;
              return newImages;
            });
          };
          reader.readAsDataURL(event.data);
        }
      };

      sockets.push(ws);
    });

    return () => sockets.forEach(socket => socket.close());
  }, []);

  const [mainImage, ...otherImages] = images;
  const [mainEndpoint, ...otherEndpoints] = ENDPOINTS;
  const overallConnected = connectionStatus.every(s => s === 'open');

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 font-sans">
      <main className="flex-grow">
        <div className="w-full max-w-screen-2xl mx-auto px-8 py-10">
          <header className="mb-12 border-b border-neutral-200 pb-6">
            <h1 className="text-5xl font-bold text-neutral-800 tracking-tight">Real-time Camera Feeds</h1>
            <p className="text-lg text-neutral-500 mt-3">Live streams from 4 different camera perspectives.</p>
          </header>
          
          <div className="space-y-8">
              {/* Main image view */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200/80">
                  <div className="bg-neutral-800 text-white px-5 py-3 text-base font-semibold">{mainEndpoint.title}</div>
                  <div className="bg-neutral-100 flex items-center justify-center p-4 min-h-[400px]">
                      {mainImage ? <img src={mainImage} alt={mainEndpoint.title} className="max-w-full h-auto object-contain rounded-md" /> : <LoadingIndicator />}
                  </div>
              </div>

              {/* Other images grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {otherImages.map((src, index) => (
                  <div key={otherEndpoints[index].path} className="bg-white rounded-xl shadow-lg overflow-hidden border border-neutral-200/80 transition-shadow hover:shadow-2xl">
                      <div className="bg-neutral-800 text-white px-5 py-3 text-base font-semibold">{otherEndpoints[index].title}</div>
                      <div className="aspect-w-16 aspect-h-9 bg-neutral-100 flex items-center justify-center">
                          {src ? <img src={src} alt={otherEndpoints[index].title} className="w-full h-full object-cover" /> : <LoadingIndicator />}
                      </div>
                  </div>
              ))}
              </div>
          </div>
        </div>
      </main>

      <footer className="w-full bg-white border-t border-neutral-200">
        <div className="max-w-screen-2xl mx-auto px-8 py-4 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
                Real-time stream viewer
            </p>
            <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${overallConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm font-semibold text-neutral-700">
                    {overallConnected ? 'All systems operational' : 'Connection issues'}
                </span>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default ImageViewer;
