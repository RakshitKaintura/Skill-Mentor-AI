import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('renders simple text correctly', () => {
    render(<MarkdownRenderer content="Hello, World!" />)
    expect(screen.getByText('Hello, World!')).toBeDefined()
  })

  it('renders bold text correctly', () => {
    render(<MarkdownRenderer content="**Bold Text**" />)
    const boldElement = screen.getByText('Bold Text')
    expect(boldElement.tagName).toBe('STRONG')
  })

  it('renders links correctly', () => {
    render(<MarkdownRenderer content="[OpenAI](https://openai.com)" />)
    const linkElement = screen.getByText('OpenAI') as HTMLAnchorElement
    expect(linkElement.tagName).toBe('A')
    expect(linkElement.href).toBe('https://openai.com/')
  })

  it('renders lists correctly', () => {
    render(<MarkdownRenderer content={"- Item 1\n- Item 2"} />)
    expect(screen.getByText('Item 1')).toBeDefined()
    expect(screen.getByText('Item 2')).toBeDefined()
  })
})
