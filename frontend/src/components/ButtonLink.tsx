import { Link, type LinkProps } from '@tanstack/react-router'
import styles from './Button.module.css'

interface ButtonLinkProps extends LinkProps {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'default' | 'large'
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function ButtonLink({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const classes = [
    styles.btn,
    styles[variant],
    size === 'large' ? styles.large : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Link className={classes} {...props}>
      {children}
    </Link>
  )
}
