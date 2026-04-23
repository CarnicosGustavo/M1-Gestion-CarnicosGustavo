"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@finopenpos/ui/components/card";
import { Button } from "@finopenpos/ui/components/button";
import { useTranslations } from "next-intl";
import { SettingsIcon } from "lucide-react";

// Lazy load tab components
import dynamic from "next/dynamic";
const RecipesTab = dynamic(() => import("./tabs/recipes"), { ssr: false });
const PaymentsTab = dynamic(() => import("./tabs/payments"), { ssr: false });

type SettingTab = "recipes" | "payments";

const TABS: { id: SettingTab; label: string; icon: string }[] = [
  { id: "recipes", label: "Recetas", icon: "📋" },
  { id: "payments", label: "Métodos de Pago", icon: "💳" },
];

export default function SettingsPage() {
  const t = useTranslations("common");
  const [activeTab, setActiveTab] = useState<SettingTab>("recipes");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Configuración</h1>
      </div>

      {/* Main Card with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Sistema</CardTitle>
          <CardDescription>Gestiona todos los parámetros del sistema desde aquí</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b">
            {TABS.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                className={`rounded-b-none ${
                  activeTab === tab.id ? "border-b-2 border-primary" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {activeTab === "recipes" && <RecipesTab />}
            {activeTab === "payments" && <PaymentsTab />}
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            💡 <strong>Consejo:</strong> Todos los cambios en esta sección se guardan automáticamente.
            Los ajustes de configuración afectan al funcionamiento del sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
