import { createFileRoute } from '@tanstack/react-router'
import Layout from '../../components/Layout'

export const Route = createFileRoute('/_authenticated/_layout')({
  component: Layout,
})
