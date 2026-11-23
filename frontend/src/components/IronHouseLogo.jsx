import React from 'react'
import IronXLogo from './IronXLogo.jsx'

/**
 * Backward compatibility wrapper for IronXLogo
 * Directs all legacy IronHouseLogo calls to the official IRONX brand logo.
 */
export default function IronHouseLogo(props) {
  return <IronXLogo {...props} />
}
