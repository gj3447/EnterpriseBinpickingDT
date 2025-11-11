import Link from 'next/link';
import { Presentation, Bot, Grid, Camera } from 'lucide-react';

export default function MainPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 py-12">
      <div className="text-center mb-16 px-4">
        <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Enterprise BinPicking DT
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          원하는 페이지를 선택하세요.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-8">
        <Link href="/landing">
          <div className="group relative w-72 h-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden">
            <Presentation className="w-20 h-20 text-blue-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              제품 소개 페이지
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              서비스의 주요 기능과 가치를 확인하세요.
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></div>
          </div>
        </Link>
        <Link href="/robot-dt">
          <div className="group relative w-72 h-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden">
            <Bot className="w-20 h-20 text-green-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              로봇 DT 페이지
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              디지털 트윈으로 로봇 상태를 확인합니다.
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500 transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></div>
          </div>
        </Link>
        <Link href="/robot-path-learning">
          <div className="group relative w-72 h-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden">
            <Grid className="w-20 h-20 text-purple-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              로봇 경로 학습
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              100개의 로봇으로 경로를 학습합니다.
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-500 transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></div>
          </div>
        </Link>
        <Link href="/image-viewer">
          <div className="group relative w-72 h-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden">
            <Camera className="w-20 h-20 text-red-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              이미지 뷰어
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              실시간 이미지 스트림을 확인합니다.
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500 transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></div>
          </div>
        </Link>
        <Link href="/ycb-browser">
          <div className="group relative w-72 h-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-6 text-center cursor-pointer overflow-hidden">
            <Camera className="w-20 h-20 text-amber-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              YCB 데이터 뷰어
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              ycb_images에서 물체 이미지 후보를 선택합니다.
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500 transition-transform duration-300 scale-x-0 group-hover:scale-x-100"></div>
          </div>
        </Link>
      </div>
    </main>
  );
}
