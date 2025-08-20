import React, { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Download, Calendar, TrendingUp, Wallet, AlertCircle, Brain, FileText, ChevronDown, ChevronUp, Target, Percent } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { toPng } from 'html-to-image';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Import the image
import logoImage from '../assets/image-removebg-preview (4).png';

// Convert image to data URL
const getImageAsDataUrl = (imgPath) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imgPath;
  });
};

pdfMake.vfs = pdfFonts.pdfMake.vfs;

const MonthlyReport = () => {
	const { user } = useAuth();
	const { symbol } = useCurrency();
	const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [reportData, setReportData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [aiInsights, setAiInsights] = useState([]);
	const [generatingInsights, setGeneratingInsights] = useState(false);
	const [expandedSections, setExpandedSections] = useState({
		summary: true,
		charts: true,
		insights: true,
		recommendations: true
	});

	// Chart refs for PDF image capture
	const categoryChartRef = useRef(null);
	const dailyChartRef = useRef(null);
	const paymentChartRef = useRef(null);

	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

	const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#8B5CF6', '#6366F1'];

	const displayName = user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email || 'User';

	useEffect(() => {
		if (user) {
			generateReport();
		}
	}, [user, selectedMonth, selectedYear]);

	const generateReport = async () => {
		if (!user) return;
		setLoading(true);
		try {
			const startDate = new Date(selectedYear, selectedMonth, 1);
			const endDate = new Date(selectedYear, selectedMonth + 1, 0);

			const { data: expenses, error: expensesError } = await supabase
				.from('expenses')
				.select('*')
				.eq('user_id', user.id)
				.gte('date', startDate.toISOString().split('T')[0])
				.lte('date', endDate.toISOString().split('T')[0]);
			if (expensesError) throw expensesError;

			const { data: budgetData, error: budgetError } = await supabase
				.from('budgets')
				.select('*')
				.eq('user_id', user.id)
				.eq('budget_month', monthNames[selectedMonth])
				.eq('budget_year', selectedYear)
				.single();
			if (budgetError && budgetError.code !== 'PGRST116') {
				console.error('Budget fetch error:', budgetError);
			}

			const totalExpenses = expenses?.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) || 0;
			const baseBudget = budgetData?.monthly_budget_total || 0;
			const extraIncome = budgetData?.extra_income_amount ? Number(budgetData.extra_income_amount) : 0;
			const totalBudget = baseBudget + extraIncome;
			const remaining = totalBudget - totalExpenses;
			const budgetUsage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

			const categoryBreakdown = {};
			expenses?.forEach(exp => {
				if (!exp.category) return;
				if (!categoryBreakdown[exp.category]) categoryBreakdown[exp.category] = 0;
				categoryBreakdown[exp.category] += Number(exp.amount) || 0;
			});

			const paymentMethodBreakdown = {};
			expenses?.forEach(exp => {
				if (!exp.payment_method) return;
				if (!paymentMethodBreakdown[exp.payment_method]) paymentMethodBreakdown[exp.payment_method] = 0;
				paymentMethodBreakdown[exp.payment_method] += Number(exp.amount) || 0;
			});

			const dailySpending = {};
			expenses?.forEach(exp => {
				const day = new Date(exp.date).getDate();
				if (!dailySpending[day]) dailySpending[day] = 0;
				dailySpending[day] += Number(exp.amount) || 0;
			});
			const dailyData = Array.from({ length: endDate.getDate() }, (_, i) => ({ day: i + 1, spent: dailySpending[i + 1] || 0 }));

			const topExpenses = expenses?.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5) || [];

			const report = {
				month: monthNames[selectedMonth],
				year: selectedYear,
				totalExpenses,
				totalBudget,
				baseBudget,
				extraIncome,
				remaining,
				budgetUsage,
				categoryBreakdown,
				paymentMethodBreakdown,
				dailyData,
				topExpenses,
				totalTransactions: expenses?.length || 0,
				averageTransaction: expenses?.length > 0 ? totalExpenses / expenses.length : 0
			};

			setReportData(report);
			await generateAIInsights(report);
		} catch (error) {
			console.error('Error generating report:', error);
		} finally {
			setLoading(false);
		}
	};

	const generateAIInsights = async (report) => {
		if (!report) return;
		setGeneratingInsights(true);
		try {
			const response = await fetch('http://localhost:5000/api/ai/monthly-insights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: user.id, reportData: report })
			});
			if (response.ok) {
				const data = await response.json();
				setAiInsights(data.insights || []);
			} else {
				setAiInsights([
					"Your highest expense category this month might need attention.",
					"Consider setting up a budget for better financial management.",
					"Track your recurring expenses to identify potential savings."
				]);
			}
		} catch (error) {
			console.error('Error generating AI insights:', error);
			setAiInsights([
				"Your highest expense category this month might need attention.",
				"Consider setting up a budget for better financial management.",
				"Track your recurring expenses to identify potential savings."
			]);
		} finally {
			setGeneratingInsights(false);
		}
	};



	const downloadPdfReport = async () => {
		if (!reportData) return;
		// Ask user for password (cannot access login password directly for security reasons)
		const password = window.prompt('Set a password to encrypt the PDF (use your login password).');
		if (!password) return;

		// Convert image to data URL
		const logoDataUrl = await getImageAsDataUrl(logoImage);

		// Create PDF content with the image at the top
		const content = [
			{
				image: logoDataUrl,
				width: 150,
				margin: [0, 0, 0, 20],
				alignment: 'center'
			},
			{ text: 'Monthly Financial Report', style: 'header', alignment: 'center', margin: [0, 0, 0, 10] },
			{ text: `${reportData.month} ${reportData.year}`, style: 'subheader', alignment: 'center', margin: [0, 4, 0, 0] },
			{ text: `User: ${displayName}`, alignment: 'center', margin: [0, 2, 0, 12] },
			{ text: `Generated on ${new Date().toLocaleDateString()}`, style: 'tiny', alignment: 'center', margin: [0, 0, 0, 16] },

			{
				table: {
					widths: ['*', '*', '*', '*'],
					body: [
						[
							{ text: 'Total Expenses', style: 'cardLabel' },
							{ text: 'Total Budget', style: 'cardLabel' },
							{ text: 'Remaining', style: 'cardLabel' },
							{ text: 'Budget Usage', style: 'cardLabel' }
						],
						[
							{ text: `${symbol}${reportData.totalExpenses.toLocaleString()}`, style: 'cardValue' },
							{ text: `${symbol}${reportData.totalBudget.toLocaleString()} (Base: ${symbol}${reportData.baseBudget.toLocaleString()} + Extra: ${symbol}${reportData.extraIncome.toLocaleString()})`, style: 'cardValue' },
							{ text: `${symbol}${reportData.remaining.toLocaleString()}`, style: reportData.remaining >= 0 ? 'positive' : 'negative' },
							{ text: `${reportData.budgetUsage.toFixed(1)}%`, style: 'cardValue' }
						]
					]
				},
				layout: 'lightHorizontalLines',
				margin: [0, 0, 0, 16]
			},

			{ text: 'Category Breakdown', style: 'sectionTitle' },
			// Capture charts as images
			categoryChartRef.current && {
				image: await toPng(categoryChartRef.current, { cacheBust: true, backgroundColor: '#ffffff' }),
				width: 480,
				margin: [0, 8, 0, 16]
			},

			{ text: 'Daily Spending Trend', style: 'sectionTitle' },
			dailyChartRef.current && {
				image: await toPng(dailyChartRef.current, { cacheBust: true, backgroundColor: '#ffffff' }),
				width: 480,
				margin: [0, 8, 0, 16]
			},

			Object.keys(reportData.paymentMethodBreakdown).length > 0 && (
				[
					{ text: 'Payment Methods', style: 'sectionTitle' },
					paymentChartRef.current && {
						image: await toPng(paymentChartRef.current, { cacheBust: true, backgroundColor: '#ffffff' }),
						width: 480,
						margin: [0, 8, 0, 16]
					}
				]
			),

			{ text: 'Top Expenses', style: 'sectionTitle' },
			{
				table: {
					widths: ['*', '*', 'auto', 'auto'],
					body: [
						[{ text: 'Description', bold: true }, { text: 'Category', bold: true }, { text: 'Amount', bold: true }, { text: 'Date', bold: true }],
						...reportData.topExpenses.map(exp => [
							exp.description,
							exp.category,
							`${symbol}${Number(exp.amount).toLocaleString()}`,
							new Date(exp.date).toLocaleDateString()
						])
					]
				},
				layout: 'lightHorizontalLines',
				margin: [0, 8, 0, 16]
			},

			{ text: 'AI Insights', style: 'sectionTitle' },
			{ ul: aiInsights.map(i => `\u{1F4A1} ${i}`) },
		];

		const docDefinition = {
			info: { title: `Monthly Financial Report - ${reportData.month} ${reportData.year}` },
			userPassword: password,
			ownerPassword: password,
			permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false, fillingForms: false, contentAccessibility: false, documentAssembly: false },
			content,
			styles: {
				header: { fontSize: 18, bold: true },
				subheader: { fontSize: 12, color: '#4B5563' },
				sectionTitle: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
				cardLabel: { bold: true, color: '#6B7280', margin: [0, 0, 0, 6] },
				cardValue: { fontSize: 12, bold: true },
				positive: { color: '#059669', bold: true },
				negative: { color: '#DC2626', bold: true },
				tiny: { fontSize: 8, color: '#6B7280' }
			},
			pageMargins: [40, 40, 40, 40]
		};

		pdfMake.createPdf(docDefinition).download(`Monthly_Report_${reportData.month}_${reportData.year}.pdf`);
	};



	const toggleSection = (section) => {
		setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
	};

	if (!user) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
					<h2 className="text-xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
					<p className="text-gray-500">Please log in to view your monthly reports.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto space-y-8">
			<div className="text-center">
				<h1 className="text-3xl font-bold text-gray-900 mb-2">Monthly Financial Report</h1>
				<p className="text-gray-600">Comprehensive analysis of your monthly spending patterns</p>
			</div>
			<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
				<div className="flex items-center justify-center gap-4 mb-6">
					<div className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-gray-600" />
						<span className="text-sm font-medium text-gray-700">Select Month:</span>
					</div>
					<select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
						{monthNames.map((month, index) => (<option key={index} value={index}>{month}</option>))}
					</select>
					<select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
						{years.map(year => (<option key={year} value={year}>{year}</option>))}
					</select>
					<button onClick={downloadPdfReport} disabled={!reportData || loading} className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
						<Download className="h-4 w-4 mr-2" />
						Download PDF
					</button>
				</div>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
						<p className="text-gray-600">Generating your monthly report...</p>
					</div>
				</div>
			) : reportData ? (
				<>
					<div className="section-header" onClick={() => toggleSection('summary')}>
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 cursor-pointer hover:shadow-xl transition-all duration-300">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold text-gray-900">Financial Summary</h2>
								{expandedSections.summary ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
							</div>
						</div>
					</div>

					{expandedSections.summary && (
						<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-gray-600 mb-1">Total Expenses</p>
										<p className="text-2xl font-bold text-gray-900">{symbol}{reportData.totalExpenses.toLocaleString()}</p>
									</div>
									<div className="bg-red-100 p-3 rounded-full"><Wallet className="h-6 w-6 text-red-600" /></div>
								</div>
							</div>
							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-gray-600 mb-1">Total Budget</p>
										<p className="text-2xl font-bold text-gray-900">{symbol}{reportData.totalBudget.toLocaleString()} <span className="text-xs text-gray-500 font-normal">(Base: {symbol}{reportData.baseBudget.toLocaleString()} + Extra: {symbol}{reportData.extraIncome.toLocaleString()})</span></p>
									</div>
									<div className="bg-blue-100 p-3 rounded-full"><Target className="h-6 w-6 text-blue-600" /></div>
								</div>
							</div>
							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-gray-600 mb-1">Remaining</p>
										<p className={`text-2xl font-bold ${reportData.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>{symbol}{reportData.remaining.toLocaleString()}</p>
									</div>
									<div className={`p-3 rounded-full ${reportData.remaining >= 0 ? 'bg-green-100' : 'bg-red-100'}`}><TrendingUp className={`h-6 w-6 ${reportData.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`} /></div>
								</div>
							</div>
							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-gray-600 mb-1">Budget Usage</p>
										<p className="text-2xl font-bold text-gray-900">{reportData.budgetUsage.toFixed(1)}%</p>
									</div>
									<div className="bg-purple-100 p-3 rounded-full"><Percent className="h-6 w-6 text-purple-600" /></div>
								</div>
							</div>
						</div>
					)}

					<div className="section-header" onClick={() => toggleSection('charts')}>
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 cursor-pointer hover:shadow-xl transition-all duration-300">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold text-gray-900">Visual Analytics</h2>
								{expandedSections.charts ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
							</div>
						</div>
					</div>

					{expandedSections.charts && (
						<div className="space-y-8">
							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6" ref={categoryChartRef}>
								<h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h3>
								<ResponsiveContainer width="100%" height={300}>
									<PieChart>
										<Pie data={Object.entries(reportData.categoryBreakdown).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
											{Object.entries(reportData.categoryBreakdown).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
										</Pie>
										<Tooltip formatter={(value) => `${symbol}${value.toLocaleString()}`} />
									</PieChart>
								</ResponsiveContainer>
							</div>

							<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6" ref={dailyChartRef}>
								<h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Spending Trend</h3>
								<ResponsiveContainer width="100%" height={300}>
									<LineChart data={reportData.dailyData}>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="day" />
										<YAxis />
										<Tooltip formatter={(value) => `${symbol}${value.toLocaleString()}`} />
										<Line type="monotone" dataKey="spent" stroke="#3B82F6" strokeWidth={2} />
									</LineChart>
								</ResponsiveContainer>
							</div>

							{Object.keys(reportData.paymentMethodBreakdown).length > 0 && (
								<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6" ref={paymentChartRef}>
									<h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
									<ResponsiveContainer width="100%" height={300}>
										<BarChart data={Object.entries(reportData.paymentMethodBreakdown).map(([name, value]) => ({ name, value }))}>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis dataKey="name" />
											<YAxis />
											<Tooltip formatter={(value) => `${symbol}${value.toLocaleString()}`} />
											<Bar dataKey="value" fill="#8B5CF6" />
										</BarChart>
									</ResponsiveContainer>
								</div>
							)}
						</div>
					)}

					<div className="section-header" onClick={() => toggleSection('insights')}>
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 cursor-pointer hover:shadow-xl transition-all duration-300">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold text-gray-900">AI-Powered Insights</h2>
								{expandedSections.insights ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
							</div>
						</div>
					</div>

					{expandedSections.insights && (
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
							<div className="flex items-center gap-3 mb-6">
								<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center"><Brain className="h-5 w-5 text-white" /></div>
								<div>
									<h3 className="text-lg font-semibold text-gray-900">Smart Financial Analysis</h3>
									<p className="text-sm text-gray-600">AI-generated insights based on your spending patterns</p>
								</div>
							</div>
							{generatingInsights ? (
								<div className="flex items-center justify-center py-8"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-3"></div><p className="text-gray-600">Generating insights...</p></div></div>
							) : (
								<div className="space-y-4">{aiInsights.map((insight, index) => (<div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200"><div className="flex items-start gap-3"><div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-white text-sm font-bold">{index + 1}</span></div><p className="text-gray-700">{insight}</p></div></div>))}</div>
							)}
						</div>
					)}

					<div className="section-header" onClick={() => toggleSection('recommendations')}>
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 cursor-pointer hover:shadow-xl transition-all duration-300">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold text-gray-900">Top Expenses & Recommendations</h2>
								{expandedSections.recommendations ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
							</div>
						</div>
					</div>

					{expandedSections.recommendations && (
						<div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
							<h3 className="text-lg font-semibold text-gray-900 mb-4">Highest Expenses This Month</h3>
							<div className="space-y-3">{reportData.topExpenses.map((expense, index) => (
								<div key={expense.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
									<div className="flex items-center gap-3">
										<div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : index === 2 ? 'bg-yellow-500' : 'bg-gray-500'}`}>{index + 1}</div>
										<div><p className="font-medium text-gray-900">{expense.description}</p><p className="text-sm text-gray-600">{expense.category}</p></div>
									</div>
									<div className="text-right"><p className="font-bold text-gray-900">{symbol}{Number(expense.amount).toLocaleString()}</p><p className="text-sm text-gray-600">{new Date(expense.date).toLocaleDateString()}</p></div>
								</div>
							))}
							</div>
							<div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
								<h4 className="font-semibold text-green-900 mb-2">💡 Quick Tips</h4>
								<ul className="text-sm text-green-800 space-y-1">
									<li>• Review your top 3 expenses to identify potential savings</li>
									<li>• Consider setting spending limits for high-expense categories</li>
									<li>• Look for recurring expenses that could be optimized</li>
								</ul>
							</div>
						</div>
					)}
				</>
			) : (
				<div className="text-center py-12"><FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">No report data available for the selected month.</p></div>
			)}
		</div>
	);
};

export default MonthlyReport;
