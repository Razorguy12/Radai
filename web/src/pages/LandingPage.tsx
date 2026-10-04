import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AppHeader } from '../components/AppHeader'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
}

const features = [
  {
    title: 'Structured Findings',
    desc: 'AI generates anatomically organized findings with severity levels — ready for clinical review.',
    icon: '📋',
  },
  {
    title: 'Doctor-in-the-Loop',
    desc: 'Edit impressions, findings, and recommendations before finalizing. You stay in control.',
    icon: '✏️',
  },
  {
    title: 'One-Click PDF Export',
    desc: 'Download professionally formatted radiology reports instantly.',
    icon: '📄',
  },
  {
    title: 'Report History',
    desc: 'Search, filter, and revisit past reports by patient ID, name, or modality.',
    icon: '🗂️',
  },
  {
    title: 'Modality Templates',
    desc: 'Pre-built templates for CT Chest, MRI Brain, Ultrasound, and more.',
    icon: '🔬',
  },
  {
    title: 'Admin Management',
    desc: 'Hospital admins can onboard radiologists and oversee report activity.',
    icon: '👥',
  },
]

const steps = [
  { num: '1', title: 'Enter Study Details', desc: 'Patient info, modality, clinical history — or pick a template.' },
  { num: '2', title: 'AI Drafts Report', desc: 'Structured findings, impression, and recommendations in seconds.' },
  { num: '3', title: 'Review & Export', desc: 'Edit, mark final, and download a professional PDF.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader variant="landing" />

      {/* Hero */}
      <section className="flex-1 px-4 sm:px-6 py-10 sm:py-16 max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-dark leading-tight mb-4 sm:mb-6">
              AI-Assisted Radiology Reporting in Minutes
            </h1>
            <p className="text-base sm:text-lg text-slate-600 mb-6 sm:mb-8 leading-relaxed">
              RadAI Reports helps radiologists draft structured, clinically accurate reports faster —
              with full editing control before you sign off.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link to="/login" className="btn btn-primary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4 text-center">Get Started</Link>
              <a href="#how-it-works" className="btn btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4 text-center">See How It Works</a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-panel p-4 sm:p-6 max-w-md mx-auto lg:mx-0 w-full"
          >
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">Sample Report Preview</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium">John Doe · ID 123456</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Study</span>
                <span className="font-medium">CT Chest w/ Contrast</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-semibold text-primary-dark mb-1">Finding 1 — Right Upper Lobe</div>
                <div className="text-slate-600">5mm pulmonary nodule, mild severity</div>
              </div>
              <div className="bg-primary/5 rounded-lg p-3">
                <div className="font-semibold text-primary-dark mb-1">Impression</div>
                <div className="text-slate-600">Small pulmonary nodule — follow-up CT in 6 months recommended.</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-4 sm:px-6 py-10 sm:py-16 bg-white/40">
        <div className="max-w-6xl mx-auto">
          <motion.h2 {...fadeUp} className="text-3xl font-bold text-primary-dark text-center mb-12">
            How It Works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-panel p-8 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold text-primary-dark mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-16 max-w-6xl mx-auto w-full">
        <motion.h2 {...fadeUp} className="text-3xl font-bold text-primary-dark text-center mb-12">
          Built for Radiologists
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="glass-panel p-6 cursor-default"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold text-primary-dark mb-2">{f.title}</h3>
              <p className="text-slate-600 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="px-6 py-8 bg-primary/5 border-y border-primary/10">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-sm font-medium text-primary-dark">
          <span>Structured JSON Output</span>
          <span>Doctor-in-the-Loop Editing</span>
          <span>Secure JWT Authentication</span>
          <span>Draft & Final Status Tracking</span>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <motion.div {...fadeUp} className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-primary-dark mb-4">Ready to streamline your reporting?</h2>
          <p className="text-slate-600 mb-6">Sign in with your hospital credentials to start generating reports.</p>
          <Link to="/login" className="btn btn-primary text-lg px-10 py-4">Sign In to RadAI Reports</Link>
        </motion.div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-slate-500 border-t border-white/40">
        RadAI Reports — Intelligent Radiology Reporting Portal
      </footer>
    </div>
  )
}
