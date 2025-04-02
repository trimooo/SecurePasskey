import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from './button';
import { Separator } from './separator';
import { Progress } from './progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { AlertCircle, AlertTriangle, Calendar, Copy, RefreshCw, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from './badge';
import { format } from 'date-fns';

interface SecurityReport {
  totalPasswords: number;
  weakPasswords: Array<{ id: number; website: string; username: string; reason: string }>;
  duplicatePasswords: Array<{ id: number; website: string; username: string; duplicateCount: number }>;
  oldPasswords: Array<{ id: number; website: string; username: string; lastUpdated: Date }>;
  reusedPasswords: Array<{ id: number; website: string; username: string; reusedCount: number }>;
  overallScore: number;
  recommendations: string[];
}

export const SecurityReport = () => {
  const [showReport, setShowReport] = useState(false);

  const { data: report, isLoading, isError, refetch } = useQuery<SecurityReport>({
    queryKey: ['/api/security-report'],
    enabled: showReport,
  });

  const handleGenerateReport = () => {
    setShowReport(true);
    refetch();
  };

  if (!showReport) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 space-y-4">
        <div className="flex flex-col items-center text-center space-y-2 mb-4">
          <ShieldCheck className="h-16 w-16 text-primary" />
          <h2 className="text-2xl font-bold">Security Health Check</h2>
          <p className="text-gray-500 max-w-md">
            Generate a comprehensive report to identify security vulnerabilities in your saved passwords
          </p>
        </div>
        <Button onClick={handleGenerateReport} className="w-full max-w-xs">
          Generate Security Report
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-pulse flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 bg-primary/20 rounded-full"></div>
          <div className="h-6 w-48 bg-gray-200 rounded"></div>
          <div className="h-4 w-64 bg-gray-200 rounded"></div>
        </div>
        <Progress value={45} className="w-full max-w-md" />
        <p className="text-sm text-gray-500">Analyzing your passwords...</p>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-semibold">Error Generating Report</h2>
        <p className="text-gray-500 text-center max-w-md">
          There was an error while generating your security report. Please try again.
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Calculate score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Get score background based on value
  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100'; 
    return 'bg-red-100';
  };

  // Get appropriate icon based on score
  const getScoreIcon = (score: number) => {
    if (score >= 80) return <ShieldCheck className="h-8 w-8 text-green-500" />;
    if (score >= 60) return <Shield className="h-8 w-8 text-yellow-500" />;
    return <ShieldAlert className="h-8 w-8 text-red-500" />;
  };

  return (
    <div className="w-full">
      <div className="flex flex-col space-y-6">
        {/* Score Overview */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Security Health Report</CardTitle>
              <Button onClick={() => refetch()} size="sm" variant="ghost">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <CardDescription>Analyzed {report.totalPasswords} passwords in your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className={`p-3 rounded-full ${getScoreBackground(report.overallScore)}`}>
                  {getScoreIcon(report.overallScore)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Security Score</div>
                  <div className={`text-3xl font-bold ${getScoreColor(report.overallScore)}`}>
                    {report.overallScore}%
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Weak</span>
                  <span className="text-xl font-bold">{report.weakPasswords.length}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Duplicated</span>
                  <span className="text-xl font-bold">{report.duplicatePasswords.length / 2}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Reused</span>
                  <span className="text-xl font-bold">{report.reusedPasswords.length / 2}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Old</span>
                  <span className="text-xl font-bold">{report.oldPasswords.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Detailed Reports */}
        <Tabs defaultValue="weak" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="weak">Weak</TabsTrigger>
            <TabsTrigger value="duplicate">Duplicated</TabsTrigger>
            <TabsTrigger value="reused">Reused</TabsTrigger>
            <TabsTrigger value="old">Old</TabsTrigger>
          </TabsList>
          
          <TabsContent value="weak">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weak Passwords</CardTitle>
                <CardDescription>
                  {report.weakPasswords.length === 0 
                    ? "Great job! You don't have any weak passwords."
                    : `Found ${report.weakPasswords.length} passwords with security issues`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.weakPasswords.length > 0 ? (
                  <div className="space-y-4">
                    {report.weakPasswords.map((pw, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{pw.website}</h3>
                            <p className="text-sm text-gray-500">{pw.username}</p>
                            <Badge variant="destructive" className="mt-2">{pw.reason}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mb-2" />
                    <p className="text-gray-500">All your passwords meet the minimum strength requirements</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="duplicate">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Duplicate Passwords</CardTitle>
                <CardDescription>
                  {report.duplicatePasswords.length === 0 
                    ? "Great job! You're using unique passwords across your accounts."
                    : `Found ${report.duplicatePasswords.length / 2} passwords used across multiple sites`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.duplicatePasswords.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group by duplicate count to show passwords together */}
                    {Object.entries(
                      report.duplicatePasswords.reduce((acc: Record<string, typeof report.duplicatePasswords>, curr) => {
                        // Use username+password combo as key to group
                        const key = `${curr.duplicateCount}`;
                        acc[key] = [...(acc[key] || []), curr];
                        return acc;
                      }, {})
                    ).map(([count, passwords]) => (
                      <div key={count} className="border rounded-lg p-3">
                        <h3 className="font-medium mb-2">
                          Same password used in {passwords[0].duplicateCount} places:
                        </h3>
                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                          {passwords.map((pw, i) => (
                            <div key={i} className="flex items-center">
                              <Copy className="h-3 w-3 text-gray-400 mr-2" />
                              <span className="font-medium">{pw.website}</span>
                              <span className="text-gray-500 text-sm ml-2">({pw.username})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mb-2" />
                    <p className="text-gray-500">All your passwords are unique across different websites</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reused">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reused Username/Password Combinations</CardTitle>
                <CardDescription>
                  {report.reusedPasswords.length === 0 
                    ? "Great job! You don't reuse the same credentials across sites."
                    : `Found ${report.reusedPasswords.length / 2} reused username/password combinations`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.reusedPasswords.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(
                      report.reusedPasswords.reduce((acc: Record<string, typeof report.reusedPasswords>, curr) => {
                        // Use a fixed key to group (since we're only showing identical combos)
                        const key = `group-${curr.reusedCount}`;
                        acc[key] = [...(acc[key] || []), curr];
                        return acc;
                      }, {})
                    ).map(([group, passwords]) => (
                      <div key={group} className="border rounded-lg p-3">
                        <h3 className="font-medium mb-2">
                          Same credential used across {passwords[0].reusedCount} sites:
                        </h3>
                        <p className="text-sm mb-2 text-gray-500">
                          <span className="font-medium">Username:</span> {passwords[0].username}
                        </p>
                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                          {passwords.map((pw, i) => (
                            <div key={i} className="flex items-center">
                              <Copy className="h-3 w-3 text-gray-400 mr-2" />
                              <span>{pw.website}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mb-2" />
                    <p className="text-gray-500">You don't reuse the same credentials across different websites</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="old">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Old Passwords</CardTitle>
                <CardDescription>
                  {report.oldPasswords.length === 0 
                    ? "Great job! All your passwords are up-to-date."
                    : `Found ${report.oldPasswords.length} passwords that haven't been updated in 3+ months`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.oldPasswords.length > 0 ? (
                  <div className="space-y-4">
                    {report.oldPasswords.map((pw, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{pw.website}</h3>
                            <p className="text-sm text-gray-500">{pw.username}</p>
                            <div className="flex items-center mt-2 text-sm">
                              <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                              <span>Last updated: {format(new Date(pw.lastUpdated), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldCheck className="h-12 w-12 text-green-500 mb-2" />
                    <p className="text-gray-500">All your passwords have been updated within the last 3 months</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};