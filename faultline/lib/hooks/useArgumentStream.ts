import { useState, useCallback, useRef, useMemo } from 'react'
import type {
  ArgumentEvent,
  ArgumentState,
  ArgumentMessage,
  ExpertsGeneratedData,
  MainArgumentsData,
  LevelCompleteData,
  BaseScoresData,
  QBAFEvaluatedData,
  QBAFHierarchyNode,
  CounterfactualData,
  ConsensusData,
  ReportData,
  ArgumentCompleteData,
  BaselineResult,
} from '@/lib/argument/types'
import { createInitialState } from '@/lib/argument/types'
import type { BridgeConfig } from '@/lib/argument/bridge'

function flattenHierarchy(
  nodes: QBAFHierarchyNode[],
  experts: string[],
  parentId?: string,
  depth: number = 0,
): ArgumentMessage[] {
  const messages: ArgumentMessage[] = []
  for (const node of nodes) {
    if (!node.statement) continue
    const expertIndex = experts.indexOf(node.expert)
    const msgType = depth === 0 ? 'main_argument' as const
      : node.relation === 'attack' ? 'attack' as const
      : 'support' as const
    const id = `node-${node.node_id}`
    messages.push({
      id,
      expertName: node.expert || 'Unknown',
      expertIndex: expertIndex >= 0 ? expertIndex : 0,
      content: node.statement,
      type: msgType,
      parentId,
      depth,
      scores: (node.initial_score !== null || node.final_score !== null) ? {
        initial: node.initial_score,
        final: node.final_score,
      } : undefined,
    })
    if (node.supplementary_args?.length) {
      messages.push(...flattenHierarchy(node.supplementary_args, experts, id, depth + 1))
    }
  }
  return messages
}

export function useArgumentStream(config: BridgeConfig) {
  const [state, setState] = useState<ArgumentState>(createInitialState())
  const startedRef = useRef(false)

  const start = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true

    setState({ ...createInitialState(), phase: 'starting', topic: config.topic })

    const run = async () => {
      try {
        const res = await fetch('/api/argument', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })

        if (!res.ok) {
          const err = await res.json()
          setState(s => ({ ...s, phase: 'error', error: err.error || 'Request failed' }))
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setState(s => ({ ...s, phase: 'error', error: 'No response body' }))
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6).trim()
            if (!json) continue

            try {
              const event = JSON.parse(json) as ArgumentEvent
              handleEvent(event)
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (error) {
        setState(s => ({
          ...s,
          phase: 'error',
          error: error instanceof Error ? error.message : 'Stream error',
        }))
      }
    }

    const handleEvent = (event: ArgumentEvent) => {
      switch (event.type) {
        case 'argument_start':
          setState(s => ({ ...s, phase: 'starting' }))
          break

        case 'experts_generated': {
          const data = event.data as ExpertsGeneratedData
          setState(s => ({
            ...s,
            phase: 'experts',
            experts: data.experts,
            task: data.task,
          }))
          break
        }

        case 'main_arguments_generated': {
          const data = event.data as MainArgumentsData
          setState(s => ({
            ...s,
            phase: 'arguments',
            mainArguments: data.main_arguments,
          }))
          break
        }

        case 'level1_complete':
        case 'level2_complete':
        case 'level3_complete': {
          const data = event.data as LevelCompleteData
          setState(s => ({
            ...s,
            phase: 'building',
            levelInfo: data.included_in_graphs ? s.levelInfo : data,
          }))
          break
        }

        case 'base_scores_assigned': {
          const data = event.data as BaseScoresData
          setState(s => ({
            ...s,
            phase: 'scoring',
            baseScores: data.scores,
          }))
          break
        }

        case 'qbaf_evaluated': {
          const data = event.data as QBAFEvaluatedData
          setState(s => ({
            ...s,
            phase: 'evaluating',
            qbafStrengths: data.strengths,
            qbafHierarchy: data.hierarchy ?? [],
          }))
          break
        }

        case 'counterfactual_complete': {
          const data = event.data as CounterfactualData
          setState(s => ({
            ...s,
            phase: 'analyzing',
            counterfactual: data,
          }))
          break
        }

        case 'consensus_generated': {
          const data = event.data as ConsensusData
          setState(s => ({ ...s, consensus: data }))
          break
        }

        case 'report_generated': {
          const data = event.data as ReportData
          setState(s => ({ ...s, report: data }))
          break
        }

        case 'argument_complete': {
          const data = event.data as ArgumentCompleteData
          setState(s => ({
            ...s,
            phase: 'complete',
            fullResult: data,
          }))
          break
        }

        case 'baselines_started': {
          setState(s => ({ ...s, phase: 'baselines' }))
          break
        }

        case 'baseline_result': {
          const data = event.data as {
            method: string
            label: string
            answer: string | null
            reasoning: string | null
            main_task?: string
            token_usage?: Record<string, number>
            error?: string
          }
          const result: BaselineResult = {
            method: data.method as BaselineResult['method'],
            label: data.label,
            answer: data.answer,
            reasoning: data.reasoning,
            mainTask: data.main_task,
            tokenUsage: data.token_usage,
            error: data.error,
          }
          setState(s => ({
            ...s,
            baselineResults: [...s.baselineResults, result],
          }))
          break
        }

        case 'baselines_complete': {
          setState(s => ({ ...s, phase: 'complete' }))
          break
        }

        // Real-time progress events from ARGORA pipeline
        case 'progress_task_extracted':
          setState(s => ({ ...s, phase: 'starting' }))
          break
        case 'progress_experts_selected':
          setState(s => ({ ...s, phase: 'experts' }))
          break
        case 'progress_main_arguments_ready':
          setState(s => ({ ...s, phase: 'arguments' }))
          break
        case 'progress_first_level_complete':
          setState(s => ({ ...s, phase: 'building' }))
          break
        case 'progress_graph_debate_complete':
          setState(s => ({ ...s, phase: 'building' }))
          break
        case 'progress_scoring_complete':
          setState(s => ({ ...s, phase: 'scoring' }))
          break
        case 'progress_counterfactual_complete':
          setState(s => ({ ...s, phase: 'analyzing' }))
          break

        case 'error': {
          const data = event.data as { message: string }
          setState(s => ({
            ...s,
            phase: 'error',
            error: data.message,
          }))
          break
        }
      }
    }

    run()
  }, [config])

  const messages = useMemo(() => {
    if (state.qbafHierarchy.length > 0) {
      return flattenHierarchy(state.qbafHierarchy, state.experts)
    }
    // Before hierarchy arrives, show main arguments as flat messages
    return state.mainArguments.map((arg, i): ArgumentMessage => {
      const expert = arg.expert || (Array.isArray(arg.experts) ? (arg.experts as string[])[0] : '') || 'Expert'
      return {
        id: `main-${i}`,
        expertName: expert,
        expertIndex: state.experts.indexOf(expert),
        content: arg.statement,
        type: 'main_argument',
        depth: 0,
      }
    })
  }, [state.qbafHierarchy, state.mainArguments, state.experts])

  return { state, messages, start }
}
