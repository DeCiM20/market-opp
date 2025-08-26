export const dateLocale = (date: Date | string): string => {
  // Months array to convert month index to month name
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  date = new Date(date)

  // Get various components of the date
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? "PM" : "AM"

  // Convert hours from 24-hour format to 12-hour format
  hours = hours % 12
  hours = hours ? hours : 12 // Handle midnight (0 hours)

  // Construct the formatted date string
  const formattedDate = `${day} ${month} ${year} ${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`
  return formattedDate
}
