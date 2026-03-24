import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { FilterBar } from "../components/layout/filter-bar";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { TierBadge } from "../components/dashboard/tier-badge";
import { StatusBadge } from "../components/dashboard/status-badge";
import { ArrowRightLeft, CheckCircle2, Download, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

const recommendations = [
  {
    id: 1,
    fromUnit: "MAC089",
    fromRegion: "KwaZulu-Natal - Rural",
    fromDoorOpens: 512,
    fromTemp: "BAD",
    toUnit: "MAC234",
    toRegion: "Gauteng - Johannesburg",
    toDoorOpens: 2876,
    toTemp: "OK",
    score: 94,
    expectedImpact: "+1,850 opens/month",
    reasons: ["Low activity at source", "High temp variance", "Urban demand gap"],
  },
  {
    id: 2,
    fromUnit: "MAC567",
    fromRegion: "Eastern Cape - Port Elizabeth",
    fromDoorOpens: 687,
    fromTemp: "WARN",
    toUnit: "MAC045",
    toRegion: "Gauteng - Pretoria",
    toDoorOpens: 3298,
    toTemp: "OK",
    score: 89,
    expectedImpact: "+1,620 opens/month",
    reasons: ["Declining rural traffic", "Better urban placement", "Temp control issues"],
  },
  {
    id: 3,
    fromUnit: "MAC890",
    fromRegion: "KwaZulu-Natal - Durban Suburbs",
    fromDoorOpens: 598,
    fromTemp: "OK",
    toUnit: "MAC123",
    toRegion: "Western Cape - Cape Town CBD",
    toDoorOpens: 3187,
    toTemp: "OK",
    score: 87,
    expectedImpact: "+1,480 opens/month",
    reasons: ["Underutilized location", "High-traffic opportunity", "Optimal conditions"],
  },
  {
    id: 4,
    fromUnit: "MAC901",
    fromRegion: "Eastern Cape - East London",
    fromDoorOpens: 456,
    fromTemp: "BAD",
    toUnit: "MAC456",
    toRegion: "Western Cape - Stellenbosch",
    toDoorOpens: 2654,
    toTemp: "OK",
    score: 83,
    expectedImpact: "+1,290 opens/month",
    reasons: ["Very low activity", "Critical temp issues", "Tourist zone demand"],
  },
];

export function RedistributionPage() {
  return (
    <>
      <FilterBar />
      <div className="p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="w-8 h-8 text-blue-600" />
            Redistribution Recommendations
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered recommendations for optimizing fleet placement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export All
          </Button>
          <Button className="gap-2">
            <Sparkles className="w-4 h-4" />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Summary Alert */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                4 High-Priority Recommendations
              </h3>
              <p className="text-sm text-gray-700">
                Expected combined impact: <strong>+6,240 opens/month</strong> across the fleet.
                Focus on units with low activity and temperature compliance issues in rural areas.
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Recommendation Cards */}
      <div className="space-y-6 mb-8">
        {recommendations.map((rec) => (
          <Card key={rec.id} className="border-2 hover:border-blue-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge className="text-lg px-3 py-1 bg-blue-600">
                    Score: {rec.score}
                  </Badge>
                  <div>
                    <p className="text-sm text-gray-600">Recommendation #{rec.id}</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {rec.expectedImpact}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Reviewed
                  </Button>
                  <Button size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* From Unit */}
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800 font-semibold mb-2 uppercase">
                    From (Low Performance)
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    {rec.fromUnit}
                  </p>
                  <p className="text-sm text-gray-700 mb-3">{rec.fromRegion}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Door Opens:</span>
                      <span className="text-sm font-medium text-red-700">
                        {rec.fromDoorOpens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Temp Status:</span>
                      <StatusBadge
                        status={rec.fromTemp === "OK" ? "ok" : rec.fromTemp === "WARN" ? "warn" : "bad"}
                        label={rec.fromTemp}
                      />
                    </div>
                    <TierBadge tier="bronze" className="mt-2" />
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRightLeft className="w-12 h-12 text-blue-600" />
                    <p className="text-xs text-gray-600 text-center">
                      Recommended Swap
                    </p>
                  </div>
                </div>

                {/* To Unit */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800 font-semibold mb-2 uppercase">
                    To (High Opportunity)
                  </p>
                  <p className="text-lg font-semibold text-gray-900 mb-1">
                    {rec.toUnit}
                  </p>
                  <p className="text-sm text-gray-700 mb-3">{rec.toRegion}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Door Opens:</span>
                      <span className="text-sm font-medium text-green-700">
                        {rec.toDoorOpens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Temp Status:</span>
                      <StatusBadge status="ok" label="OK" />
                    </div>
                    <TierBadge tier="gold" className="mt-2" />
                  </div>
                </div>
              </div>

              {/* Reason Codes */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  Key Reasons:
                </p>
                <div className="flex flex-wrap gap-2">
                  {rec.reasons.map((reason, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Agent Panel */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Recommendation AI Agent Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-700">
              Based on comprehensive analysis of door activity, temperature compliance, and regional demand patterns, 
              the AI recommends prioritizing the following actions:
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold mt-0.5">1.</span>
                <span>
                  <strong>Immediate Action:</strong> Relocate MAC089 from rural KwaZulu-Natal to Gauteng. 
                  This unit has critical temperature issues and minimal activity, while Johannesburg shows 
                  consistent high demand.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold mt-0.5">2.</span>
                <span>
                  <strong>Secondary Priority:</strong> Move MAC567 from Eastern Cape to Gauteng. 
                  The source location shows declining traffic trends, and temperature warnings indicate 
                  maintenance challenges.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold mt-0.5">3.</span>
                <span>
                  <strong>Opportunity Swaps:</strong> Consider MAC890 and MAC901 for Western Cape tourist 
                  zones, where weekend activity is 3x higher than current locations.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-semibold mt-0.5">4.</span>
                <span>
                  <strong>Regional Balance:</strong> After redistribution, Gauteng will have optimal coverage 
                  while reducing underperforming rural deployments by 40%.
                </span>
              </li>
            </ul>
            <div className="pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600">
                <strong>Expected Fleet Impact:</strong> +12.8% overall door activity, -35% temperature 
                non-compliance incidents, improved regional balance score from 67 to 84.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
