import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, Zap } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center relative z-10"
      >
        <div className="inline-flex p-4 rounded-3xl bg-primary/10 mb-6">
          <Zap className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-6xl font-bold text-gradient mb-3">404</h1>
        <p className="text-xl text-muted-foreground mb-8">الصفحة غير موجودة</p>
        <Link to="/">
          <Button className="rounded-2xl bg-primary hover:bg-primary/90 glow-sm px-8 h-12">
            <Home className="w-4 h-4 mr-2" />
            العودة للرئيسية
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
