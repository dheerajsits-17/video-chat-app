import React from "react";
import { useNavigate } from "react-router-dom";
import { Video, Shield, Zap, Globe } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Video size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">Meet-Live</span>
        </div>
        <button
          onClick={() => navigate("/chat")}
          className="bg-white text-black px-6 py-2 rounded-full font-medium hover:bg-zinc-200 transition-all text-sm"
        >
          Launch App
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
          Connect instantly <br /> with anyone, anywhere.
        </h1>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate("/chat")}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 active:scale-95"
          >
            Start New Meeting
          </button>
        </div>
      </main>
    </div>
  );
};

export default Home;
