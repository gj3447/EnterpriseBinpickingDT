import { HeroSection } from "./components/HeroSection";
import { FeatureSection } from "./components/FeatureSection";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <main className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
      <HeroSection />

      <FeatureSection 
        title="정밀성"
        description="Cognex 3D-A1000 & UR5e Robotics"
        visual="quantum"
      />
      <FeatureSection 
        title="연결성"
        description="Real-time data streams via OPC UA and WebSocket."
        visual="connectivity"
      />
      <FeatureSection 
        title="지능"
        description="YOLOv8n Detection & SegNet Segmentation"
        visual="neuralNetwork"
      />

      <Footer />
    </main>
  );
}

